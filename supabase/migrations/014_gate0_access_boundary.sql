-- Every browser role, including owner, is read-only at the database boundary.
revoke create on schema public from public, anon, authenticated;
create or replace function public.has_live_session()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = nullif(auth.jwt()->>'session_id', '')::uuid
      and s.user_id = auth.uid()
  );
$$;

create or replace function public.is_active_admin(check_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select check_user_id = auth.uid() and public.has_live_session() and exists (
    select 1 from public.admin_profiles
    where user_id = check_user_id and active and role in ('owner', 'admin', 'viewer')
  );
$$;

create or replace function public.admin_session_context()
returns table (id uuid, user_id uuid, name text, role text, active boolean, session_id uuid)
language sql stable security definer set search_path = '' as $$
  select p.id, p.user_id, p.name, p.role, p.active,
    nullif(auth.jwt()->>'session_id', '')::uuid
  from public.admin_profiles p
  where p.user_id = auth.uid() and public.is_active_admin(auth.uid());
$$;

drop policy admin_profiles_self_read on public.admin_profiles;
create policy admin_profiles_self_read on public.admin_profiles for select to authenticated
  using (user_id = (select auth.uid()) and public.has_live_session());

alter table public.rate_limits enable row level security;
alter table public.email_outbox enable row level security;
create policy active_admin_read on public.rate_limits for select to authenticated
  using (public.is_active_admin((select auth.uid())));
create policy active_admin_read on public.email_outbox for select to authenticated
  using (public.is_active_admin((select auth.uid())));

revoke all on public.rate_limits, public.email_outbox from public, anon, authenticated;
grant select on public.rate_limits, public.email_outbox to authenticated;
grant all on public.rate_limits, public.email_outbox to service_role;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke all on function public.has_live_session(), public.is_active_admin(uuid),
  public.admin_session_context(), public.set_updated_at() from public, anon, authenticated;
grant execute on function public.has_live_session(), public.is_active_admin(uuid),
  public.admin_session_context() to authenticated, service_role;

-- Caller supplies the Auth-verified actor/session. Only the server role can call.
-- Recheck inside the same transaction as each mutation and its audit record.
create function public.admin_set_inventory(
  p_actor_user_id uuid, p_session_id uuid, p_tyre_product_id uuid,
  p_stock_qty integer default null, p_selling_price_pence integer default null
) returns public.inventory language plpgsql security definer set search_path = '' as $$
declare changed public.inventory; actor public.admin_profiles;
begin
  select * into actor from public.admin_profiles where user_id = p_actor_user_id for share;
  if not found or not actor.active or actor.role not in ('owner', 'admin') or not exists (
    select 1 from auth.sessions where id = p_session_id and user_id = p_actor_user_id
  ) then raise insufficient_privilege using message = 'Operational access required'; end if;
  if (p_stock_qty is null and p_selling_price_pence is null)
     or p_stock_qty < 0 or p_selling_price_pence <= 0 then
    raise check_violation using message = 'Invalid inventory change';
  end if;
  update public.inventory set
    stock_qty = coalesce(p_stock_qty, stock_qty),
    selling_price_pence = coalesce(p_selling_price_pence, selling_price_pence)
  where tyre_product_id = p_tyre_product_id returning * into changed;
  if not found then raise no_data_found using message = 'Inventory not found'; end if;
  insert into public.audit_logs(admin_user_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, 'inventory.updated', 'inventory', changed.id,
    jsonb_build_object('stock_qty', changed.stock_qty, 'selling_price_pence', changed.selling_price_pence));
  return changed;
end;
$$;

create function public.owner_set_admin_access(
  p_actor_user_id uuid, p_session_id uuid, p_target_user_id uuid, p_role text, p_active boolean
) returns public.admin_profiles language plpgsql security definer set search_path = '' as $$
declare changed public.admin_profiles; actor public.admin_profiles;
begin
  -- Serialize owner-count decisions, including simultaneous demotions.
  perform pg_catalog.pg_advisory_xact_lock(70824001);
  select * into actor from public.admin_profiles where user_id = p_actor_user_id for share;
  if not found or not actor.active or actor.role <> 'owner' or not exists (
    select 1 from auth.sessions where id = p_session_id and user_id = p_actor_user_id
  ) then raise insufficient_privilege using message = 'Owner access required'; end if;
  if p_role is null or p_role not in ('owner', 'admin', 'viewer') or p_active is null then
    raise check_violation using message = 'Invalid access change';
  end if;
  select * into changed from public.admin_profiles where user_id = p_target_user_id for update;
  if not found then raise no_data_found using message = 'Admin profile not found'; end if;
  if changed.active and changed.role = 'owner' and (not p_active or p_role <> 'owner')
    and (select count(*) from public.admin_profiles where active and role = 'owner') <= 1 then
    raise check_violation using message = 'The last active owner must be retained';
  end if;
  update public.admin_profiles set role = p_role, active = p_active
    where user_id = p_target_user_id returning * into changed;
  insert into public.audit_logs(admin_user_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, 'admin.access_updated', 'admin_profiles', changed.id,
    jsonb_build_object('role', p_role, 'active', p_active));
  return changed;
end;
$$;

-- One atomic counter; concurrent first requests cannot each create a window.
create function public.consume_rate_limit(p_bucket_key text, p_max_hits integer, p_window_minutes integer)
returns table (allowed boolean, remaining integer)
language plpgsql security definer set search_path = '' as $$
declare counter public.rate_limits;
begin
  if nullif(btrim(p_bucket_key), '') is null or p_max_hits < 1 or p_window_minutes < 1
    or p_max_hits is null or p_window_minutes is null then
    raise check_violation using message = 'Invalid rate limit';
  end if;
  insert into public.rate_limits(bucket_key, hits, expires_at)
  values (p_bucket_key, 0, now() + make_interval(mins => p_window_minutes))
  on conflict (bucket_key) do nothing;
  select * into counter from public.rate_limits where bucket_key = p_bucket_key for update;
  if counter.expires_at <= now() then
    update public.rate_limits set hits = 0, window_start = now(),
      expires_at = now() + make_interval(mins => p_window_minutes)
      where id = counter.id returning * into counter;
  end if;
  if counter.hits >= p_max_hits then return query select false, 0; return; end if;
  update public.rate_limits set hits = hits + 1 where id = counter.id returning * into counter;
  return query select true, greatest(0, p_max_hits - counter.hits);
end;
$$;

revoke all on function public.admin_set_inventory(uuid,uuid,uuid,integer,integer),
  public.owner_set_admin_access(uuid,uuid,uuid,text,boolean),
  public.consume_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.admin_set_inventory(uuid,uuid,uuid,integer,integer),
  public.owner_set_admin_access(uuid,uuid,uuid,text,boolean),
  public.consume_rate_limit(text,integer,integer) to service_role;
