-- Gate 4: owner-operated admin system. No business rows are seeded.
alter table public.audit_logs
  add column before_state jsonb,
  add column after_state jsonb;

create table if not exists public.special_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  start_time time,
  end_time time,
  slot_duration_minutes integer check (slot_duration_minutes is null or slot_duration_minutes > 0),
  capacity integer check (capacity is null or capacity > 0),
  active boolean not null default true,
  note text check (note is null or length(btrim(note)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((not active) or (start_time is not null and end_time is not null and end_time > start_time
    and slot_duration_minutes is not null and capacity is not null))
);
create trigger special_dates_set_updated_at before update on public.special_dates
  for each row execute function public.set_updated_at();
create index idx_special_dates_date_active on public.special_dates(date,active);
alter table public.special_dates enable row level security;
create policy active_admin_read on public.special_dates for select to authenticated
  using (public.is_active_admin((select auth.uid())));
revoke all on public.special_dates from public,anon,authenticated;
grant select on public.special_dates to authenticated;
grant all on public.special_dates to service_role;

alter table public.business_settings
  add column vat_rate_bps integer check (vat_rate_bps is null or vat_rate_bps between 0 and 10000),
  add column terms_and_conditions text,
  add column privacy_policy text;

alter table public.payments
  add column refunded_at timestamptz,
  add column refund_amount_pence integer,
  add column refund_reference text,
  add column refunded_by_admin_id uuid references public.admin_profiles(id) on delete restrict,
  add constraint payments_manual_refund_details_check check (
    provider <> 'manual'
    or (status = 'refunded' and refunded_at is not null
      and refund_amount_pence = amount_pence
      and nullif(btrim(refund_reference),'') is not null
      and refunded_by_admin_id is not null)
    or (status <> 'refunded' and refunded_at is null and refund_amount_pence is null
      and refund_reference is null and refunded_by_admin_id is null)
  );

create function public.guard_audit_history() returns trigger
language plpgsql set search_path='' as $$
begin
  raise exception using errcode='55000',message='Audit history is immutable';
end;
$$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.guard_audit_history();

create function public.admin_os_audit(p_actor uuid,p_action text,p_type text,p_id uuid,
  p_before jsonb,p_after jsonb,p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path='' as $$
  insert into public.audit_logs(admin_user_id,action,resource_type,resource_id,before_state,after_state,metadata)
  values(p_actor,p_action,p_type,p_id,p_before,p_after,coalesce(p_metadata,'{}'::jsonb));
$$;

-- Older Gate 3 functions write metadata-only events. Complete those records at
-- insert time so the immutable audit stream always exposes meaningful states.
create function public.complete_admin_audit() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.before_state is null and new.after_state is null then
    if new.action='payment.bank_received' then
      new.before_state:=jsonb_build_object('booking_status','AWAITING_BANK_PAYMENT','payment_status','pending');
      new.after_state:=jsonb_build_object('booking_status','CONFIRMED','payment_status','received') || coalesce(new.metadata,'{}'::jsonb);
    elsif new.action='payment.window_extended' then
      new.before_state:=jsonb_build_object('expires_at',new.metadata->'old_expires_at');
      new.after_state:=jsonb_build_object('expires_at',new.metadata->'expires_at');
    else
      new.after_state:=coalesce(new.metadata,'{}'::jsonb);
    end if;
  end if;
  return new;
end;
$$;
create trigger audit_logs_complete before insert on public.audit_logs
  for each row execute function public.complete_admin_audit();

-- Gate 3 protected immutable checkout terms. Gate 4 adds explicit, audited
-- operational exceptions without permitting arbitrary row edits.
create or replace function public.guard_bank_booking() returns trigger
language plpgsql set search_path='' as $$
declare action jsonb := jsonb_build_object('id','','kind','') || coalesce(nullif(current_setting('gforce.bank_action',true),''),'{}')::jsonb;
begin
  if old.checkout_key is not null then
    if (to_jsonb(new)-'status'-'updated_at'-'bank_payment_expires_at'-'booking_source'-'fitter_id'-'slot_id'-'admin_notes') is distinct from
       (to_jsonb(old)-'status'-'updated_at'-'bank_payment_expires_at'-'booking_source'-'fitter_id'-'slot_id'-'admin_notes') then
      raise exception using errcode='55000',message='Bank reservation terms are immutable';
    end if;
    if new.booking_source is distinct from old.booking_source and not (
      old.booking_source='online' and new.booking_source='phone'
      and action->>'id'=old.id::text and action->>'kind'='phone') then
      raise exception using errcode='55000',message='Phone booking requires an authorized transaction';
    end if;
    if new.bank_payment_expires_at is distinct from old.bank_payment_expires_at and not (
      action->>'id'=old.id::text and action->>'kind'='extend'
      and new.status='AWAITING_BANK_PAYMENT' and new.bank_payment_expires_at>old.bank_payment_expires_at) then
      raise exception using errcode='55000',message='Payment window requires an audited extension';
    end if;
    if new.fitter_id is distinct from old.fitter_id and not (
      action->>'id'=old.id::text and action->>'kind'='assign') then
      raise exception using errcode='55000',message='Fitter assignment requires an authorized transaction';
    end if;
    if new.slot_id is distinct from old.slot_id and not (
      action->>'id'=old.id::text and action->>'kind'='reschedule') then
      raise exception using errcode='55000',message='Rescheduling requires an authorized transaction';
    end if;
    if new.admin_notes is distinct from old.admin_notes and not (
      action->>'id'=old.id::text and action->>'kind' in ('assign','status','reschedule','cancel','refund')) then
      raise exception using errcode='55000',message='Admin notes require an authorized transaction';
    end if;
    if new.status is distinct from old.status and not (
      (old.status='AWAITING_BANK_PAYMENT' and new.status='EXPIRED' and old.bank_payment_expires_at<=clock_timestamp())
      or (old.status='AWAITING_BANK_PAYMENT' and new.status='CONFIRMED'
        and action->>'id'=old.id::text and action->>'kind'='verify'
        and exists(select 1 from public.payments p where p.booking_id=old.id and p.provider='manual'
          and p.status='received' and p.paid_at is not null and p.verified_by_admin_id is not null))
      or (old.status='EXPIRED' and new.status='AWAITING_BANK_PAYMENT'
        and action->>'id'=old.id::text and action->>'kind'='extend')
      or (action->>'id'=old.id::text and action->>'kind' in ('status','cancel','refund'))) then
      raise exception using errcode='55000',message='Booking status requires an authorized transaction';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_manual_payment() returns trigger
language plpgsql set search_path='' as $$
declare action jsonb := jsonb_build_object('id','','kind','') || coalesce(nullif(current_setting('gforce.bank_action',true),''),'{}')::jsonb;
begin
  if old.provider='manual' then
    if tg_op='DELETE' then raise exception using errcode='55000',message='Manual payment history cannot be deleted'; end if;
    if (to_jsonb(new)-'status'-'paid_at'-'verified_by_admin_id'-'updated_at'-'refunded_at'-'refund_amount_pence'-'refund_reference'-'refunded_by_admin_id') is distinct from
       (to_jsonb(old)-'status'-'paid_at'-'verified_by_admin_id'-'updated_at'-'refunded_at'-'refund_amount_pence'-'refund_reference'-'refunded_by_admin_id') then
      raise exception using errcode='55000',message='Manual payment terms are immutable';
    end if;
    if (new.status,new.paid_at,new.verified_by_admin_id,new.refunded_at,new.refund_amount_pence,new.refund_reference,new.refunded_by_admin_id) is distinct from
       (old.status,old.paid_at,old.verified_by_admin_id,old.refunded_at,old.refund_amount_pence,old.refund_reference,old.refunded_by_admin_id) and not (
      (old.status='pending' and new.status='received' and action->>'id'=old.booking_id::text and action->>'kind'='verify')
      or (old.status='pending' and new.status='cancelled' and action->>'id'=old.booking_id::text and action->>'kind'='cancel')
      or (old.status='received' and new.status='refunded' and action->>'id'=old.booking_id::text and action->>'kind'='refund')) then
      raise exception using errcode='55000',message='Manual payment change requires an authorized transaction';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.owner_set_bank_settings(p_actor_user_id uuid,p_session_id uuid,
  p_bank_account_name text,p_bank_name text,p_sort_code text,p_account_number text,p_window_minutes integer)
returns void language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb;
begin
  perform public.assert_bank_operator(p_actor_user_id,p_session_id,true);
  select jsonb_build_object('configured',bank_account_name is not null and bank_name is not null
    and sort_code is not null and account_number is not null,'window_minutes',bank_payment_window_minutes)
    into before_row from public.business_settings where id=1 for update;
  update public.business_settings set bank_account_name=nullif(btrim(p_bank_account_name),''),
    bank_name=nullif(btrim(p_bank_name),''),sort_code=nullif(p_sort_code,''),account_number=nullif(p_account_number,''),
    bank_payment_window_minutes=p_window_minutes where id=1
    returning jsonb_build_object('configured',bank_account_name is not null and bank_name is not null
      and sort_code is not null and account_number is not null,'window_minutes',bank_payment_window_minutes) into after_row;
  perform public.admin_os_audit(p_actor_user_id,'bank.settings_updated','business_settings',null,before_row,after_row);
end;
$$;

create or replace function public.owner_set_admin_access(
  p_actor_user_id uuid,p_session_id uuid,p_target_user_id uuid,p_role text,p_active boolean
) returns public.admin_profiles language plpgsql security definer set search_path='' as $$
declare changed public.admin_profiles; actor public.admin_profiles; prior jsonb;
begin
  perform pg_advisory_xact_lock(70824001);
  select * into actor from public.admin_profiles where user_id=p_actor_user_id for share;
  if not found or not actor.active or actor.role<>'owner' or not exists(
    select 1 from auth.sessions where id=p_session_id and user_id=p_actor_user_id
  ) then raise insufficient_privilege using message='Owner access required'; end if;
  if p_role is null or p_role not in ('owner','admin','viewer') or p_active is null then
    raise check_violation using message='Invalid access change'; end if;
  select * into changed from public.admin_profiles where user_id=p_target_user_id for update;
  if not found then raise no_data_found using message='Admin profile not found'; end if;
  if p_target_user_id=p_actor_user_id and (not p_active or p_role<>'owner') then
    raise check_violation using message='Owner cannot lock out their current account'; end if;
  if changed.active and changed.role='owner' and (not p_active or p_role<>'owner')
    and (select count(*) from public.admin_profiles where active and role='owner')<=1 then
    raise check_violation using message='The last active owner must be retained'; end if;
  prior:=to_jsonb(changed)-'updated_at';
  update public.admin_profiles set role=p_role,active=p_active where user_id=p_target_user_id returning * into changed;
  perform public.admin_os_audit(p_actor_user_id,'admin.access_updated','admin_profiles',changed.id,prior,to_jsonb(changed)-'updated_at');
  return changed;
end;
$$;

create function public.owner_provision_admin(p_actor_user_id uuid,p_session_id uuid,
  p_target_user_id uuid,p_name text,p_role text)
returns public.admin_profiles language plpgsql security definer set search_path='' as $$
declare changed public.admin_profiles;
begin
  perform public.assert_bank_operator(p_actor_user_id,p_session_id,true);
  if p_target_user_id=p_actor_user_id or nullif(btrim(p_name),'') is null
    or length(btrim(p_name))>120 or p_role not in ('owner','admin','viewer')
    or not exists(select 1 from auth.users where id=p_target_user_id) then
    raise check_violation using message='Invalid access provision'; end if;
  insert into public.admin_profiles(user_id,name,role,active)
    values(p_target_user_id,btrim(p_name),p_role,true) returning * into changed;
  perform public.admin_os_audit(p_actor_user_id,'admin.provisioned','admin_profiles',changed.id,null,to_jsonb(changed)-'updated_at');
  return changed;
end;
$$;

create function public.admin_os_mutate(p_actor_user_id uuid,p_session_id uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_profile uuid; before_row jsonb; after_row jsonb; row_id uuid; b public.bookings;
  slot public.booking_slots; hold_id uuid; payment public.payments; qty record; allowed text[];
  work_date date; rule record; special public.special_dates; cursor_time time; created_count integer:=0;
begin
  actor_profile:=public.assert_bank_operator(p_actor_user_id,p_session_id);
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise invalid_parameter_value using message='Invalid payload'; end if;

  if p_action='product.save' then
    if p_payload ? 'id' then
      row_id:=(p_payload->>'id')::uuid; select to_jsonb(t) into before_row from public.tyre_products t where id=row_id for update;
      if before_row is null then raise no_data_found; end if;
      update public.tyre_products set sku=btrim(p_payload->>'sku'),slug='sku-'||encode(convert_to(btrim(p_payload->>'sku'),'UTF8'),'hex'),
        brand=btrim(p_payload->>'brand'),model=btrim(p_payload->>'model'),width=(p_payload->>'width')::int,
        profile=(p_payload->>'profile')::int,rim=(p_payload->>'rim')::int,load_index=nullif(btrim(p_payload->>'load_index'),''),
        speed_rating=nullif(btrim(p_payload->>'speed_rating'),''),run_flat=(p_payload->>'run_flat')::boolean,
        extra_load=(p_payload->>'extra_load')::boolean,season=p_payload->>'season',tier=p_payload->>'tier',
        image_url=nullif(btrim(p_payload->>'image_url'),'') where id=row_id returning to_jsonb(tyre_products.*) into after_row;
    else
      insert into public.tyre_products(sku,slug,brand,model,width,profile,rim,load_index,speed_rating,run_flat,extra_load,season,tier,image_url,active)
      values(btrim(p_payload->>'sku'),'sku-'||encode(convert_to(btrim(p_payload->>'sku'),'UTF8'),'hex'),btrim(p_payload->>'brand'),btrim(p_payload->>'model'),
        (p_payload->>'width')::int,(p_payload->>'profile')::int,(p_payload->>'rim')::int,nullif(btrim(p_payload->>'load_index'),''),
        nullif(btrim(p_payload->>'speed_rating'),''),(p_payload->>'run_flat')::boolean,(p_payload->>'extra_load')::boolean,
        p_payload->>'season',p_payload->>'tier',nullif(btrim(p_payload->>'image_url'),''),true)
      returning id,to_jsonb(tyre_products.*) into row_id,after_row;
      insert into public.inventory(tyre_product_id,stock_qty,reserved_qty,cost_price_pence,selling_price_pence,supplier_sku,low_stock_threshold)
      values(row_id,(p_payload->>'stock_qty')::int,0,(p_payload->>'cost_price_pence')::int,(p_payload->>'selling_price_pence')::int,
        nullif(btrim(p_payload->>'supplier_sku'),''),(p_payload->>'low_stock_threshold')::int);
    end if;
    perform public.admin_os_audit(p_actor_user_id,'product.saved','tyre_products',row_id,before_row,after_row); return after_row;
  elsif p_action='product.archive' then
    row_id:=(p_payload->>'id')::uuid; select to_jsonb(t) into before_row from public.tyre_products t where id=row_id for update;
    update public.tyre_products set active=false where id=row_id returning to_jsonb(tyre_products.*) into after_row;
    if after_row is null then raise no_data_found; end if;
    perform public.admin_os_audit(p_actor_user_id,'product.archived','tyre_products',row_id,before_row,after_row); return after_row;
  elsif p_action in ('inventory.adjust','inventory.cycle_count') then
    row_id:=(p_payload->>'tyre_product_id')::uuid; select to_jsonb(i) into before_row from public.inventory i where tyre_product_id=row_id for update;
    if before_row is null then raise no_data_found; end if;
    update public.inventory set stock_qty=coalesce((p_payload->>'stock_qty')::int,stock_qty),
      cost_price_pence=coalesce((p_payload->>'cost_price_pence')::int,cost_price_pence),
      selling_price_pence=coalesce((p_payload->>'selling_price_pence')::int,selling_price_pence),
      supplier_sku=case when p_payload ? 'supplier_sku' then nullif(btrim(p_payload->>'supplier_sku'),'') else supplier_sku end,
      low_stock_threshold=coalesce((p_payload->>'low_stock_threshold')::int,low_stock_threshold)
      where tyre_product_id=row_id returning id,to_jsonb(inventory.*) into hold_id,after_row;
    perform public.admin_os_audit(p_actor_user_id,replace(p_action,'.','.'),'inventory',hold_id,before_row,after_row,
      jsonb_build_object('reason',nullif(btrim(p_payload->>'reason'),''))); return after_row;
  elsif p_action in ('zone.save','zone.archive') then
    if p_payload ? 'id' then
      row_id:=(p_payload->>'id')::uuid; select to_jsonb(z) into before_row from public.service_zones z where id=row_id for update;
      update public.service_zones set name=coalesce(nullif(btrim(p_payload->>'name'),''),name),
        postcode_prefix=coalesce(nullif(upper(btrim(p_payload->>'postcode_prefix')),''),postcode_prefix),
        callout_fee_pence=coalesce((p_payload->>'callout_fee_pence')::int,callout_fee_pence),
        priority=coalesce((p_payload->>'priority')::int,priority),active=case when p_action='zone.archive' then false else coalesce((p_payload->>'active')::boolean,active) end
        where id=row_id returning to_jsonb(service_zones.*) into after_row;
    else
      insert into public.service_zones(name,postcode_prefix,callout_fee_pence,priority,active)
      values(btrim(p_payload->>'name'),upper(btrim(p_payload->>'postcode_prefix')),(p_payload->>'callout_fee_pence')::int,
        (p_payload->>'priority')::int,coalesce((p_payload->>'active')::boolean,true)) returning id,to_jsonb(service_zones.*) into row_id,after_row;
    end if;
    if after_row is null then raise no_data_found; end if;
    perform public.admin_os_audit(p_actor_user_id,p_action,'service_zones',row_id,before_row,after_row); return after_row;
  elsif p_action in ('fitter.save','fitter.archive') then
    if p_payload ? 'id' then
      row_id:=(p_payload->>'id')::uuid; select to_jsonb(f) into before_row from public.fitters f where id=row_id for update;
      update public.fitters set name=coalesce(nullif(btrim(p_payload->>'name'),''),name),
        phone=case when p_payload ? 'phone' then nullif(btrim(p_payload->>'phone'),'') else phone end,
        van_name=case when p_payload ? 'van_name' then nullif(btrim(p_payload->>'van_name'),'') else van_name end,
        active=case when p_action='fitter.archive' then false else coalesce((p_payload->>'active')::boolean,active) end
        where id=row_id returning to_jsonb(fitters.*) into after_row;
    else
      insert into public.fitters(name,phone,van_name,active) values(btrim(p_payload->>'name'),nullif(btrim(p_payload->>'phone'),''),
        nullif(btrim(p_payload->>'van_name'),''),coalesce((p_payload->>'active')::boolean,true)) returning id,to_jsonb(fitters.*) into row_id,after_row;
    end if;
    if after_row is null then raise no_data_found; end if;
    perform public.admin_os_audit(p_actor_user_id,p_action,'fitters',row_id,before_row,after_row); return after_row;
  elsif p_action='slot.generate' then
    if (p_payload->>'from_date')::date>=(p_payload->>'to_date')::date
      or (p_payload->>'to_date')::date-(p_payload->>'from_date')::date>366 then
      raise check_violation using message='Invalid generation range'; end if;
    for work_date in select generate_series((p_payload->>'from_date')::date,(p_payload->>'to_date')::date,'1 day')::date loop
      if exists(select 1 from public.blocked_dates where date=work_date) then continue; end if;
      special:=null; select * into special from public.special_dates where date=work_date;
      if found then
        if not special.active then continue; end if;
        cursor_time:=special.start_time;
        while cursor_time+make_interval(mins=>special.slot_duration_minutes)<=special.end_time loop
          insert into public.booking_slots(date,start_at,end_at,capacity,active)
          values(work_date,cursor_time,(cursor_time+make_interval(mins=>special.slot_duration_minutes))::time,special.capacity,true)
          on conflict(date,start_at,end_at) do update set capacity=excluded.capacity,active=true,blocked_reason=null;
          created_count:=created_count+1; cursor_time:=(cursor_time+make_interval(mins=>special.slot_duration_minutes))::time;
        end loop;
      else
        for rule in select * from public.availability_rules where active and day_of_week=extract(dow from work_date)::int order by start_time loop
          cursor_time:=rule.start_time;
          while cursor_time+make_interval(mins=>rule.slot_duration_minutes)<=rule.end_time loop
            insert into public.booking_slots(date,start_at,end_at,capacity,active)
            values(work_date,cursor_time,(cursor_time+make_interval(mins=>rule.slot_duration_minutes))::time,rule.capacity,true)
            on conflict(date,start_at,end_at) do update set capacity=excluded.capacity,active=true,blocked_reason=null;
            created_count:=created_count+1; cursor_time:=(cursor_time+make_interval(mins=>rule.slot_duration_minutes))::time;
          end loop;
        end loop;
      end if;
    end loop;
    after_row:=jsonb_build_object('from_date',p_payload->>'from_date','to_date',p_payload->>'to_date','slots_processed',created_count);
    perform public.admin_os_audit(p_actor_user_id,p_action,'booking_slots',null,null,after_row); return after_row;
  elsif p_action='slot.capacity' then
    row_id:=(p_payload->>'id')::uuid; select to_jsonb(s) into before_row from public.booking_slots s where id=row_id for update;
    update public.booking_slots set capacity=(p_payload->>'capacity')::int where id=row_id returning to_jsonb(booking_slots.*) into after_row;
    if after_row is null then raise no_data_found; end if;
    perform public.admin_os_audit(p_actor_user_id,p_action,'booking_slots',row_id,before_row,after_row); return after_row;
  elsif p_action='slot.rule.save' then
    if p_payload ? 'id' then
      row_id:=(p_payload->>'id')::uuid; select to_jsonb(r) into before_row from public.availability_rules r where id=row_id for update;
      update public.availability_rules set day_of_week=(p_payload->>'day_of_week')::int,start_time=(p_payload->>'start_time')::time,
        end_time=(p_payload->>'end_time')::time,slot_duration_minutes=(p_payload->>'slot_duration_minutes')::int,
        capacity=(p_payload->>'capacity')::int,active=(p_payload->>'active')::boolean where id=row_id returning to_jsonb(availability_rules.*) into after_row;
    else
      insert into public.availability_rules(day_of_week,start_time,end_time,slot_duration_minutes,capacity,active)
      values((p_payload->>'day_of_week')::int,(p_payload->>'start_time')::time,(p_payload->>'end_time')::time,
        (p_payload->>'slot_duration_minutes')::int,(p_payload->>'capacity')::int,(p_payload->>'active')::boolean)
      returning id,to_jsonb(availability_rules.*) into row_id,after_row;
    end if;
    if after_row is null then raise no_data_found; end if;
    perform public.admin_os_audit(p_actor_user_id,p_action,'availability_rules',row_id,before_row,after_row); return after_row;
  elsif p_action in ('slot.block','slot.unblock') then
    if p_action='slot.block' then
      insert into public.blocked_dates(date,reason,created_by) values((p_payload->>'date')::date,btrim(p_payload->>'reason'),p_actor_user_id)
      on conflict(date) do update set reason=excluded.reason,created_by=excluded.created_by returning id,to_jsonb(blocked_dates.*) into row_id,after_row;
      perform public.admin_os_audit(p_actor_user_id,p_action,'blocked_dates',row_id,null,after_row); return after_row;
    end if;
    select id,to_jsonb(d) into row_id,before_row from public.blocked_dates d where date=(p_payload->>'date')::date for update;
    if row_id is null then raise no_data_found; end if; delete from public.blocked_dates where id=row_id;
    perform public.admin_os_audit(p_actor_user_id,p_action,'blocked_dates',row_id,before_row,null); return before_row;
  elsif p_action in ('slot.special.save','slot.special.delete') then
    if p_action='slot.special.delete' then
      row_id:=(p_payload->>'id')::uuid; select to_jsonb(s) into before_row from public.special_dates s where id=row_id for update;
      delete from public.special_dates where id=row_id; perform public.admin_os_audit(p_actor_user_id,p_action,'special_dates',row_id,before_row,null); return before_row;
    end if;
    insert into public.special_dates(date,start_time,end_time,slot_duration_minutes,capacity,active,note)
    values((p_payload->>'date')::date,(p_payload->>'start_time')::time,(p_payload->>'end_time')::time,
      (p_payload->>'slot_duration_minutes')::int,(p_payload->>'capacity')::int,(p_payload->>'active')::boolean,nullif(btrim(p_payload->>'note'),''))
    on conflict(date) do update set start_time=excluded.start_time,end_time=excluded.end_time,
      slot_duration_minutes=excluded.slot_duration_minutes,capacity=excluded.capacity,active=excluded.active,note=excluded.note
    returning id,to_jsonb(special_dates.*) into row_id,after_row;
    perform public.admin_os_audit(p_actor_user_id,p_action,'special_dates',row_id,null,after_row); return after_row;
  elsif p_action='settings.save' then
    perform public.assert_bank_operator(p_actor_user_id,p_session_id,true);
    select to_jsonb(s) into before_row from public.business_settings s where id=1 for update;
    update public.business_settings set phone=nullif(btrim(p_payload->>'phone'),''),email=nullif(btrim(p_payload->>'email'),''),
      whatsapp=nullif(btrim(p_payload->>'whatsapp'),''),fitting_fee_pence=(p_payload->>'fitting_fee_pence')::int,
      job_duration_minutes=coalesce((p_payload->>'job_duration_minutes')::int,job_duration_minutes),
      booking_horizon_days=(p_payload->>'booking_horizon_days')::int,vat_registered=(p_payload->>'vat_registered')::boolean,
      vat_number=nullif(btrim(p_payload->>'vat_number'),''),vat_rate_bps=(p_payload->>'vat_rate_bps')::int,
      same_day_enabled=(p_payload->>'same_day_enabled')::boolean,
      same_day_cutoff=case when (p_payload->>'same_day_enabled')::boolean then (p_payload->>'same_day_cutoff')::time else null end,
      cancellation_notice_hours=(p_payload->>'cancellation_notice_hours')::int,
      cancellation_policy=nullif(btrim(p_payload->>'cancellation_policy'),''),
      terms_and_conditions=nullif(btrim(p_payload->>'terms_and_conditions'),''),privacy_policy=nullif(btrim(p_payload->>'privacy_policy'),'')
      where id=1 returning to_jsonb(business_settings.*)-'account_number'-'sort_code'-'bank_account_name'-'bank_name' into after_row;
    perform public.admin_os_audit(p_actor_user_id,p_action,'business_settings',null,
      before_row-'account_number'-'sort_code'-'bank_account_name'-'bank_name',after_row); return after_row;
  elsif p_action='settings.approve_pricing' then
    perform public.assert_bank_operator(p_actor_user_id,p_session_id,true);
    select to_jsonb(s) into before_row from public.business_settings s where id=1 for update;
    if (before_row->>'fitting_fee_pence') is null or (before_row->>'fitting_fee_pence')::int < 0
       or (before_row->>'job_duration_minutes') is null or (before_row->>'job_duration_minutes')::int <= 0
       or nullif(btrim(coalesce(before_row->>'cancellation_policy','')),'') is null
       or (before_row->>'bank_payment_window_minutes') is null or (before_row->>'bank_payment_window_minutes')::int < 1
       or nullif(btrim(coalesce(before_row->>'bank_name','')),'') is null
       or nullif(btrim(coalesce(before_row->>'bank_account_name','')),'') is null
       or nullif(btrim(coalesce(before_row->>'sort_code','')),'') is null
       or nullif(btrim(coalesce(before_row->>'account_number','')),'') is null then
      raise check_violation using message='Mandatory pricing and bank configuration must be complete before approval';
    end if;
    update public.business_settings set pricing_configured=true where id=1
      returning to_jsonb(business_settings.*)-'account_number'-'sort_code'-'bank_account_name'-'bank_name' into after_row;
    perform public.admin_os_audit(p_actor_user_id,'settings.pricing_approved','business_settings',null,
      before_row-'account_number'-'sort_code'-'bank_account_name'-'bank_name',after_row,
      jsonb_build_object('reason',p_payload->>'reason')); return after_row;
  elsif p_action='settings.revoke_pricing' then
    perform public.assert_bank_operator(p_actor_user_id,p_session_id,true);
    select to_jsonb(s) into before_row from public.business_settings s where id=1 for update;
    update public.business_settings set pricing_configured=false where id=1
      returning to_jsonb(business_settings.*)-'account_number'-'sort_code'-'bank_account_name'-'bank_name' into after_row;
    perform public.admin_os_audit(p_actor_user_id,'settings.pricing_revoked','business_settings',null,
      before_row-'account_number'-'sort_code'-'bank_account_name'-'bank_name',after_row,
      jsonb_build_object('reason',p_payload->>'reason')); return after_row;
  elsif p_action in ('booking.assign_fitter','booking.status','booking.reschedule','booking.cancel','payment.refund') then
    row_id:=(p_payload->>'booking_id')::uuid; select * into b from public.bookings where id=row_id for update;
    if not found then raise no_data_found; end if; before_row:=to_jsonb(b);
    if p_action='booking.assign_fitter' then
      if not exists(select 1 from public.fitters where id=(p_payload->>'fitter_id')::uuid and active) then raise check_violation using message='Active fitter required'; end if;
      perform set_config('gforce.bank_action',jsonb_build_object('id',b.id,'kind','assign')::text,true);
      update public.bookings set fitter_id=(p_payload->>'fitter_id')::uuid,admin_notes=nullif(btrim(p_payload->>'reason'),'') where id=b.id returning to_jsonb(bookings.*) into after_row;
    elsif p_action='booking.status' then
      allowed:=case b.status when 'CONFIRMED' then array['tyres_reserved','fitter_assigned'] when 'tyres_reserved' then array['fitter_assigned']
        when 'fitter_assigned' then array['en_route'] when 'en_route' then array['completed'] else array[]::text[] end;
      if not ((p_payload->>'status')=any(allowed)) then raise check_violation using message='Invalid operational transition'; end if;
      if (p_payload->>'status') in ('fitter_assigned','en_route') and b.fitter_id is null then
        raise check_violation using message='Assign a fitter before this status'; end if;
      perform set_config('gforce.bank_action',jsonb_build_object('id',b.id,'kind','status')::text,true);
      update public.bookings set status=p_payload->>'status',admin_notes=nullif(btrim(p_payload->>'reason'),'') where id=b.id returning to_jsonb(bookings.*) into after_row;
    elsif p_action='booking.reschedule' then
      if b.status not in ('AWAITING_BANK_PAYMENT','CONFIRMED','tyres_reserved','fitter_assigned','en_route') then
        raise check_violation using message='Booking cannot be rescheduled in its current state'; end if;
      select * into slot from public.booking_slots where id=(p_payload->>'slot_id')::uuid for update;
      if not found or not slot.active or slot.blocked_reason is not null
        or ((slot.date+slot.start_at) at time zone 'Europe/London')<=clock_timestamp()
        or public.slot_consumption(slot.id)>=slot.capacity or exists(select 1 from public.blocked_dates where date=slot.date) then
        raise check_violation using message='New slot unavailable'; end if;
      perform set_config('gforce.bank_action',jsonb_build_object('id',b.id,'kind','reschedule')::text,true);
      update public.bookings set slot_id=slot.id,admin_notes=nullif(btrim(p_payload->>'reason'),'') where id=b.id returning to_jsonb(bookings.*) into after_row;
      if b.status='AWAITING_BANK_PAYMENT' then update public.slot_holds set slot_id=slot.id where booking_id=b.id; end if;
    elsif p_action='booking.cancel' then
      if b.status in ('cancelled','refunded','completed') then raise check_violation using message='Booking cannot be cancelled'; end if;
      perform set_config('gforce.bank_action',jsonb_build_object('id',b.id,'kind','cancel')::text,true);
      update public.payments set status='cancelled' where booking_id=b.id and provider='manual' and status='pending';
      if b.status not in ('AWAITING_BANK_PAYMENT','EXPIRED','pending_payment') then
        for qty in select tyre_product_id,quantity from public.booking_items where booking_id=b.id order by tyre_product_id loop
          update public.inventory set reserved_qty=reserved_qty-qty.quantity where tyre_product_id=qty.tyre_product_id and reserved_qty>=qty.quantity;
          if not found then raise check_violation using message='Inventory allocation mismatch'; end if;
        end loop;
      end if;
      update public.slot_holds set expires_at=clock_timestamp() where booking_id=b.id;
      update public.inventory_holds h set expires_at=clock_timestamp() from public.slot_holds s where s.booking_id=b.id and h.slot_hold_id=s.id;
      update public.bookings set status='cancelled',admin_notes=btrim(p_payload->>'reason') where id=b.id returning to_jsonb(bookings.*) into after_row;
    else
      select * into payment from public.payments where booking_id=b.id and provider='manual' for update;
      if payment.status<>'received' or (p_payload->>'refund_confirmed')::boolean is distinct from true then raise check_violation using message='Actual refund confirmation required'; end if;
      if (p_payload->>'refund_amount_pence')::int is distinct from payment.amount_pence
        or nullif(btrim(p_payload->>'refund_reference'),'') is null then
        raise check_violation using message='Full refund amount and bank reference required'; end if;
      perform set_config('gforce.bank_action',jsonb_build_object('id',b.id,'kind','refund')::text,true);
      update public.payments set status='refunded',refunded_at=clock_timestamp(),
        refund_amount_pence=(p_payload->>'refund_amount_pence')::int,
        refund_reference=btrim(p_payload->>'refund_reference'),refunded_by_admin_id=actor_profile where id=payment.id;
      if b.status<>'completed' then
        for qty in select tyre_product_id,quantity from public.booking_items where booking_id=b.id order by tyre_product_id loop
          update public.inventory set reserved_qty=reserved_qty-qty.quantity where tyre_product_id=qty.tyre_product_id and reserved_qty>=qty.quantity;
          if not found then raise check_violation using message='Inventory allocation mismatch'; end if;
        end loop;
      end if;
      update public.bookings set status='refunded',admin_notes=btrim(p_payload->>'reason') where id=b.id returning to_jsonb(bookings.*) into after_row;
    end if;
    perform public.admin_os_audit(p_actor_user_id,p_action,'bookings',b.id,before_row,after_row,
      jsonb_strip_nulls(jsonb_build_object('reason',p_payload->>'reason','refund_amount_pence',p_payload->'refund_amount_pence',
        'refund_reference',p_payload->'refund_reference'))); return after_row;
  else
    raise invalid_parameter_value using message='Unknown admin action';
  end if;
end;
$$;

create function public.admin_os_import_products(p_actor_user_id uuid,p_session_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare row_data jsonb; saved integer:=0;
begin
  perform public.assert_bank_operator(p_actor_user_id,p_session_id);
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise check_violation using message='CSV import requires 1 to 500 products'; end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(row_data)<>'object' then raise check_violation using message='Invalid product row'; end if;
    perform public.admin_os_mutate(p_actor_user_id,p_session_id,'product.save',row_data);
    saved:=saved+1;
  end loop;
  return saved;
end;
$$;

revoke all on function public.guard_audit_history(),public.complete_admin_audit(),public.admin_os_audit(uuid,text,text,uuid,jsonb,jsonb,jsonb),
  public.owner_provision_admin(uuid,uuid,uuid,text,text),public.admin_os_mutate(uuid,uuid,text,jsonb),
  public.admin_os_import_products(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.owner_provision_admin(uuid,uuid,uuid,text,text),
  public.admin_os_mutate(uuid,uuid,text,jsonb),public.admin_os_import_products(uuid,uuid,jsonb) to service_role;
