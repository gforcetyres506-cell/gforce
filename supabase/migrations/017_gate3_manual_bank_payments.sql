-- Forward-only reconciliation. Historical Stripe receipts remain historical.
-- New reservations collect the full total, by manually verified bank transfer.
alter table public.business_settings
  add column bank_account_name text check (bank_account_name is null or length(btrim(bank_account_name)) between 1 and 120),
  add column bank_name text check (bank_name is null or length(btrim(bank_name)) between 1 and 120),
  add column sort_code text check (sort_code is null or sort_code ~ '^[0-9]{6}$'),
  add column account_number text check (account_number is null or account_number ~ '^[0-9]{8}$');
alter table public.bookings add column booking_source text
  check (booking_source in ('online','phone'));
alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (status in (
  'pending_payment','confirmed','tyres_reserved','fitter_assigned','en_route','completed',
  'cancelled','refunded','payment_failed','AWAITING_BANK_PAYMENT','EXPIRED','CONFIRMED'));
alter table public.payments alter column provider set default 'manual';
alter table public.payments add column payment_method text,
  add column reference text,
  add column paid_at timestamptz,
  add column verified_by_admin_id uuid references public.admin_profiles(id) on delete restrict,
  add column bank_details jsonb,
  add column updated_at timestamptz not null default now();
alter table public.payments drop constraint payments_status_check;
alter table public.payments add constraint payments_status_check check (
  status in ('pending','succeeded','failed','cancelled','refunded','received'));
alter table public.payments add constraint payments_manual_check check (provider <> 'manual' or (
  payment_method is not null and payment_method='bank_transfer'
  and status in ('pending','received','refunded','cancelled') and currency='gbp'
  and reference is not null and length(reference)>0 and amount_pence>0
  and stripe_checkout_session_id is null and stripe_payment_intent_id is null and succeeded_at is null
  and bank_details is not null and jsonb_typeof(bank_details)='object'
  and coalesce(jsonb_typeof(bank_details->'bank_name'),'')='string' and coalesce(length(bank_details->>'bank_name'),0)>0
  and coalesce(jsonb_typeof(bank_details->'bank_account_name'),'')='string' and coalesce(length(bank_details->>'bank_account_name'),0)>0
  and coalesce(bank_details->>'sort_code','') ~ '^[0-9]{6}$'
  and coalesce(bank_details->>'account_number','') ~ '^[0-9]{8}$'
  and ((status in ('received','refunded') and paid_at is not null and verified_by_admin_id is not null)
    or (status in ('pending','cancelled') and paid_at is null and verified_by_admin_id is null))));
create unique index idx_payments_manual_booking on public.payments(booking_id) where provider='manual';
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create function public.assert_bank_operator(p_actor uuid,p_session uuid,p_owner boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.admin_profiles;
begin
  -- Serialize with owner role changes; keep profile/session valid through COMMIT.
  perform pg_advisory_xact_lock(70824001);
  select * into actor from public.admin_profiles where user_id=p_actor for share;
  if not found or not actor.active or actor.role not in ('admin','owner')
    or (p_owner and actor.role<>'owner') then
    raise insufficient_privilege using message='Operational access required';
  end if;
  perform id from auth.sessions where id=p_session and user_id=p_actor for share;
  if not found then raise insufficient_privilege using message='Live session required'; end if;
  return actor.id;
end;
$$;

create or replace function public.guard_bank_booking() returns trigger
language plpgsql set search_path='' as $$
declare action jsonb := jsonb_build_object('id','','kind','') || coalesce(nullif(current_setting('gforce.bank_action',true),''),'{}')::jsonb;
begin
  if old.checkout_key is not null then
    if (to_jsonb(new)-'status'-'updated_at'-'bank_payment_expires_at'-'booking_source') is distinct from
       (to_jsonb(old)-'status'-'updated_at'-'bank_payment_expires_at'-'booking_source') then
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
    if new.status is distinct from old.status and not (
      (old.status='AWAITING_BANK_PAYMENT' and new.status='EXPIRED' and old.bank_payment_expires_at<=clock_timestamp())
      or (old.status='AWAITING_BANK_PAYMENT' and new.status='CONFIRMED'
        and action->>'id'=old.id::text and action->>'kind'='verify'
        and exists(select 1 from public.payments p where p.booking_id=old.id and p.provider='manual'
          and p.status='received' and p.paid_at is not null and p.verified_by_admin_id is not null))
      or (old.status='EXPIRED' and new.status='AWAITING_BANK_PAYMENT'
        and action->>'id'=old.id::text and action->>'kind'='extend')) then
      raise exception using errcode='55000',message='Bank payment confirmation requires a separate verified transaction';
    end if;
  end if;
  return new;
end;
$$;
create function public.guard_manual_payment() returns trigger
language plpgsql set search_path='' as $$
declare action jsonb := jsonb_build_object('id','','kind','') || coalesce(nullif(current_setting('gforce.bank_action',true),''),'{}')::jsonb;
begin
  if old.provider='manual' then
    if tg_op='DELETE' then raise exception using errcode='55000',message='Manual payment history cannot be deleted'; end if;
    if (to_jsonb(new)-'status'-'paid_at'-'verified_by_admin_id'-'updated_at') is distinct from
       (to_jsonb(old)-'status'-'paid_at'-'verified_by_admin_id'-'updated_at') then
      raise exception using errcode='55000',message='Manual payment terms are immutable';
    end if;
    if (new.status,new.paid_at,new.verified_by_admin_id) is distinct from
       (old.status,old.paid_at,old.verified_by_admin_id) and not (
      old.status='pending' and new.status='received' and action->>'id'=old.booking_id::text and action->>'kind'='verify') then
      raise exception using errcode='55000',message='Manual receipt requires authorized bank verification';
    end if;
  end if;
  return new;
end;
$$;
create trigger payments_manual_immutable before update or delete on public.payments
  for each row execute function public.guard_manual_payment();

create function public.owner_set_bank_settings(p_actor_user_id uuid,p_session_id uuid,
  p_bank_account_name text,p_bank_name text,p_sort_code text,p_account_number text,p_window_minutes integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_bank_operator(p_actor_user_id,p_session_id,true);
  update public.business_settings set bank_account_name=nullif(btrim(p_bank_account_name),''),
    bank_name=nullif(btrim(p_bank_name),''),sort_code=nullif(p_sort_code,''),account_number=nullif(p_account_number,''),
    bank_payment_window_minutes=p_window_minutes where id=1;
  insert into public.audit_logs(admin_user_id,action,resource_type,metadata)
    values(p_actor_user_id,'bank.settings_updated','business_settings',jsonb_build_object('window_minutes',p_window_minutes));
end;
$$;

create function public.admin_verify_bank_payment(p_actor_user_id uuid,p_session_id uuid,
  p_booking_id uuid,p_expected_amount_pence integer)
returns public.payments language plpgsql security definer set search_path='' as $$
declare b public.bookings; receipt public.payments; profile_id uuid; item record; stamp timestamptz;
begin
  profile_id := public.assert_bank_operator(p_actor_user_id,p_session_id);
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception using errcode='P3002',message='booking_not_found'; end if;
  select * into receipt from public.payments where booking_id=b.id and provider='manual' for update;
  if not found or p_expected_amount_pence is distinct from receipt.amount_pence then
    raise exception using errcode='P3003',message='payment_amount_mismatch'; end if;
  if b.status='CONFIRMED' and receipt.status='received' then return receipt; end if;
  if b.status<>'AWAITING_BANK_PAYMENT' or receipt.status<>'pending' then
    raise exception using errcode='P3004',message='wrong_booking_state'; end if;
  -- Same resource order as checkout. Recheck the deadline AFTER all waits.
  perform id from public.booking_slots where id=b.slot_id for update;
  perform i.id from public.inventory i join public.booking_items bi on bi.tyre_product_id=i.tyre_product_id
    where bi.booking_id=b.id order by i.tyre_product_id for update of i;
  stamp := clock_timestamp();
  if b.bank_payment_expires_at<=stamp then
    raise exception using errcode='P3005',message='reservation_expired'; end if;
  if not exists(select 1 from public.slot_holds where booking_id=b.id and expires_at>stamp)
    or exists(select 1 from public.booking_items bi where bi.booking_id=b.id and not exists (
      select 1 from public.inventory_holds h join public.slot_holds s on s.id=h.slot_hold_id
      where s.booking_id=b.id and h.tyre_product_id=bi.tyre_product_id and h.quantity=bi.quantity and h.expires_at>stamp)) then
    raise exception using errcode='P3004',message='reservation_resources_missing'; end if;
  perform set_config('gforce.bank_action',jsonb_build_object('id',b.id,'kind','verify')::text,true);
  update public.payments set status='received',paid_at=stamp,verified_by_admin_id=profile_id
    where id=receipt.id returning * into receipt;
  update public.bookings set status='CONFIRMED' where id=b.id;
  -- Convert the temporary reservation into a non-expiring operational allocation.
  -- Its booking now consumes the slot; deactivate both holds to prevent double counting.
  update public.slot_holds set expires_at=stamp where booking_id=b.id;
  update public.inventory_holds h set expires_at=stamp from public.slot_holds s
    where s.booking_id=b.id and h.slot_hold_id=s.id;
  for item in select tyre_product_id,quantity from public.booking_items where booking_id=b.id order by tyre_product_id loop
    update public.inventory set reserved_qty=reserved_qty+item.quantity where tyre_product_id=item.tyre_product_id;
  end loop;
  insert into public.audit_logs(admin_user_id,action,resource_type,resource_id,metadata)
    values(p_actor_user_id,'payment.bank_received','bookings',b.id,
      jsonb_build_object('payment_id',receipt.id,'amount_pence',receipt.amount_pence,'reference',receipt.reference,'paid_at',stamp));
  perform set_config('gforce.bank_action','',true);
  return receipt;
end;
$$;

create function public.admin_extend_bank_window(p_actor_user_id uuid,p_session_id uuid,
  p_booking_id uuid,p_minutes integer,p_reason text,p_expected_expires_at timestamptz)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare b public.bookings; chosen public.booking_slots; item record; deadline timestamptz; hold_id uuid; own_slot integer; own_qty bigint;
begin
  perform public.assert_bank_operator(p_actor_user_id,p_session_id);
  if p_minutes is null or p_minutes not between 1 and 10080 or coalesce(length(btrim(p_reason)),0) not between 3 and 500 then
    raise exception using errcode='P2001',message='invalid_extension'; end if;
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception using errcode='P3002',message='booking_not_found'; end if;
  if date_trunc('milliseconds',b.bank_payment_expires_at) is distinct from date_trunc('milliseconds',p_expected_expires_at) then
    raise exception using errcode='P3006',message='payment_window_changed'; end if;
  if b.status not in ('AWAITING_BANK_PAYMENT','EXPIRED') or not exists(
    select 1 from public.payments where booking_id=b.id and provider='manual' and status='pending') then
    raise exception using errcode='P3004',message='wrong_booking_state'; end if;
  select * into chosen from public.booking_slots where id=b.slot_id for update;
  if not found or not chosen.active or chosen.blocked_reason is not null
    or (chosen.date+chosen.start_at) at time zone 'Europe/London'<=clock_timestamp()
    or exists(select 1 from public.blocked_dates where date=chosen.date) then
    raise exception using errcode='P2002',message='slot_conflict'; end if;
  perform i.id from public.inventory i join public.booking_items bi on bi.tyre_product_id=i.tyre_product_id
    where bi.booking_id=b.id order by i.tyre_product_id for update of i;
  select count(*) into own_slot from public.slot_holds s where s.booking_id=b.id
    and s.expires_at>clock_timestamp() and b.status='AWAITING_BANK_PAYMENT' and b.bank_payment_expires_at>clock_timestamp();
  if public.slot_consumption(b.slot_id)-own_slot>=chosen.capacity then
    raise exception using errcode='P2002',message='slot_conflict'; end if;
  for item in select bi.tyre_product_id,bi.quantity,i.stock_qty,i.reserved_qty from public.booking_items bi
    left join public.inventory i on i.tyre_product_id=bi.tyre_product_id where bi.booking_id=b.id order by bi.tyre_product_id loop
    select coalesce(sum(h.quantity),0) into own_qty from public.inventory_holds h join public.slot_holds s on s.id=h.slot_hold_id
      where s.booking_id=b.id and h.tyre_product_id=item.tyre_product_id and h.expires_at>clock_timestamp()
      and s.expires_at>clock_timestamp() and b.status='AWAITING_BANK_PAYMENT' and b.bank_payment_expires_at>clock_timestamp();
    if item.stock_qty is null or item.stock_qty::bigint-item.reserved_qty-public.live_inventory_held(item.tyre_product_id)+own_qty<item.quantity then
      raise exception using errcode='P2003',message='out_of_stock'; end if;
  end loop;
  deadline := greatest(clock_timestamp(),b.bank_payment_expires_at)+make_interval(mins=>p_minutes);
  select id into hold_id from public.slot_holds where booking_id=b.id;
  if hold_id is null then raise exception using errcode='P3004',message='reservation_resources_missing'; end if;
  perform set_config('gforce.bank_action',jsonb_build_object('id',b.id,'kind','extend')::text,true);
  update public.bookings set status='AWAITING_BANK_PAYMENT',bank_payment_expires_at=deadline where id=b.id;
  update public.slot_holds set expires_at=deadline where id=hold_id;
  update public.inventory_holds set expires_at=deadline where slot_hold_id=hold_id;
  insert into public.audit_logs(admin_user_id,action,resource_type,resource_id,metadata)
    values(p_actor_user_id,'payment.window_extended','bookings',b.id,
      jsonb_build_object('old_expires_at',b.bank_payment_expires_at,'expires_at',deadline,'reason',btrim(p_reason),'minutes',p_minutes));
  perform set_config('gforce.bank_action','',true);
  return deadline;
end;
$$;

create or replace function public.reserve_booking_checkout(
  p_checkout_key uuid, p_slot_id uuid, p_items jsonb, p_customer jsonb,
  p_postcode text, p_vehicle jsonb default '{}'::jsonb, p_notes text default null
) returns table (booking_id uuid, reference text, manage_token uuid, status text,
  expires_at timestamptz, total_pence integer, deposit_pence integer, balance_pence integer)
language plpgsql security definer set search_path = '' as $$
declare
  settings public.business_settings%rowtype; chosen_slot public.booking_slots%rowtype;
  zone public.service_zones%rowtype; existing public.bookings%rowtype;
  item record; quantities jsonb; fingerprint text; customer_id uuid;
  new_booking_id uuid := gen_random_uuid(); new_hold_id uuid := gen_random_uuid();
  deadline timestamptz; subtotal bigint := 0; total bigint; deposit bigint;
  product_count integer; expected_count integer; local_today date;
begin
  if p_checkout_key is null or p_slot_id is null or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 6
    or jsonb_typeof(p_customer) is distinct from 'object' or jsonb_typeof(p_vehicle) is distinct from 'object'
    or p_postcode is null or upper(btrim(p_postcode)) !~ '^(GIR|[A-Z]{1,2}[0-9][A-Z0-9]?) [0-9][A-Z]{2}$'
    or coalesce(length(p_customer->>'name'),0) not between 2 and 80
    or coalesce(length(p_customer->>'email'),0) not between 3 and 254
    or coalesce(length(p_customer->>'phone'),0) not between 10 and 16
    or coalesce(length(p_customer->>'address_line1'),0) not between 3 and 120
    or coalesce(length(p_customer->>'address_line2'),0)>120 or coalesce(length(p_customer->>'city'),0)>60
    or coalesce(length(p_notes),0)>500
    or coalesce(length(p_vehicle->>'reg'),0)>10 or coalesce(length(p_vehicle->>'make'),0)>60
    or coalesce(length(p_vehicle->>'model'),0)>60 then
    raise exception using errcode='P2001', message='invalid_checkout';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item.value) is distinct from 'object'
      or coalesce(item.value->>'tyre_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or jsonb_typeof(item.value->'quantity') is distinct from 'number'
      or coalesce(item.value->>'quantity','') !~ '^[1-8]$'
      or (item.value-'tyre_id'-'quantity') <> '{}'::jsonb then
      raise exception using errcode='P2001', message='invalid_cart';
    end if;
  end loop;
  select jsonb_agg(jsonb_build_object('tyre_id',id,'quantity',qty) order by id),count(*)
    into quantities,expected_count from (
      select (value->>'tyre_id')::uuid id,sum((value->>'quantity')::integer) qty
      from jsonb_array_elements(p_items) group by (value->>'tyre_id')::uuid) cart;
  if exists(select 1 from jsonb_array_elements(quantities) where (value->>'quantity')::integer>8) then
    raise exception using errcode='P2001', message='invalid_cart';
  end if;
  fingerprint := encode(sha256(convert_to(jsonb_build_object('slot',p_slot_id,'items',quantities,
    'customer',p_customer,'postcode',upper(btrim(p_postcode)),'vehicle',p_vehicle,'notes',p_notes)::text,'UTF8')),'hex');
  -- Retries of one checkout serialize before resources; no duplicate customer,
  -- hold or booking, including a retry after an uncertain network response.
  perform pg_advisory_xact_lock(hashtextextended(p_checkout_key::text,0));
  perform public.expire_unpaid_bookings();
  select b.* into existing from public.bookings b where b.checkout_key=p_checkout_key for update;
  if found then
    if existing.checkout_fingerprint<>fingerprint then
      raise exception using errcode='P2005', message='checkout_key_reused';
    end if;
    return query select existing.id,existing.reference,existing.manage_token,existing.status,
      existing.bank_payment_expires_at,existing.total_pence,existing.deposit_pence,existing.balance_pence;
    return;
  end if;

  select s.* into chosen_slot from public.booking_slots s where s.id=p_slot_id for update;
  if not found or not chosen_slot.active or chosen_slot.blocked_reason is not null then
    raise exception using errcode='P2002', message='slot_conflict';
  end if;
  select s.* into settings from public.business_settings s where s.id=1 for share;
  if not found or not settings.pricing_configured or settings.fitting_fee_pence is null
    or settings.bank_payment_window_minutes is null then
    raise exception using errcode='P2004', message='pricing_unavailable';
  end if;
  if settings.bank_name is null or settings.bank_account_name is null or settings.sort_code is null or settings.account_number is null then
    raise exception using errcode='P3001', message='bank_details_not_configured';
  end if;
  local_today := (clock_timestamp() at time zone 'Europe/London')::date;
  if (chosen_slot.date+chosen_slot.start_at) at time zone 'Europe/London' <= clock_timestamp()
    or chosen_slot.date>local_today+settings.booking_horizon_days
    or exists(select 1 from public.blocked_dates d where d.date=chosen_slot.date)
    or (chosen_slot.date=local_today and (not settings.same_day_enabled
      or settings.same_day_cutoff is null
      or (clock_timestamp() at time zone 'Europe/London')::time>=settings.same_day_cutoff)) then
    raise exception using errcode='P2002', message='slot_conflict';
  end if;
  if public.slot_consumption(p_slot_id)>=chosen_slot.capacity then
    raise exception using errcode='P2002', message='slot_conflict';
  end if;
  select z.* into zone from public.service_zones z
    where z.active and z.postcode_prefix=split_part(upper(btrim(p_postcode)),' ',1)
    order by z.priority,z.id limit 1 for share;
  if not found then raise exception using errcode='P2006', message='outside_coverage'; end if;

  -- All checkout transactions lock catalogue and inventory in UUID order,
  -- regardless of the customer's cart order. Locks remain held through COMMIT.
  perform p.id from public.tyre_products p join jsonb_to_recordset(quantities) as c(tyre_id uuid,quantity integer)
    on p.id=c.tyre_id order by p.id for share of p;
  perform i.id from public.inventory i join jsonb_to_recordset(quantities) as c(tyre_id uuid,quantity integer)
    on i.tyre_product_id=c.tyre_id order by i.tyre_product_id for update of i;
  select count(*) into product_count from public.tyre_products p join public.inventory i on i.tyre_product_id=p.id
    join jsonb_to_recordset(quantities) as c(tyre_id uuid,quantity integer) on c.tyre_id=p.id where p.active;
  if product_count<>expected_count then raise exception using errcode='P2003', message='out_of_stock'; end if;
  for item in select p.*,i.stock_qty,i.reserved_qty,i.selling_price_pence,c.quantity
    from public.tyre_products p join public.inventory i on i.tyre_product_id=p.id
    join jsonb_to_recordset(quantities) as c(tyre_id uuid,quantity integer) on c.tyre_id=p.id order by p.id loop
    if item.stock_qty::bigint-item.reserved_qty-public.live_inventory_held(item.id)<item.quantity then
      raise exception using errcode='P2003', message='out_of_stock';
    end if;
    if item.selling_price_pence<=0 then raise exception using errcode='P2004', message='pricing_unavailable'; end if;
    subtotal := subtotal+item.selling_price_pence::bigint*item.quantity;
  end loop;
  total := subtotal+settings.fitting_fee_pence::bigint+zone.callout_fee_pence;
  if total not between 1 and 2147483647 then raise exception using errcode='P2004', message='pricing_unavailable'; end if;
  deposit := total; -- V1 full bank transfer; no deposit collection.
  deadline := clock_timestamp()+make_interval(mins=>settings.bank_payment_window_minutes);
  insert into public.slot_holds(id,slot_id,token,expires_at)
    values(new_hold_id,p_slot_id,p_checkout_key::text,deadline);
  insert into public.inventory_holds(slot_hold_id,tyre_product_id,quantity,expires_at)
    select new_hold_id,c.tyre_id,c.quantity,deadline
    from jsonb_to_recordset(quantities) as c(tyre_id uuid,quantity integer) order by c.tyre_id;
  insert into public.customers(first_name,last_name,email,phone)
    values(btrim(p_customer->>'name'),'',lower(btrim(p_customer->>'email')),btrim(p_customer->>'phone')) returning id into customer_id;
  insert into public.bookings(id,reference,customer_id,slot_id,service_zone_id,
    registration,vehicle_make,vehicle_model,fitting_address,postcode,customer_notes,status,
    subtotal_pence,fitting_fee_pence,callout_fee_pence,total_pence,deposit_pence,balance_pence,
    checkout_key,checkout_fingerprint,bank_payment_expires_at,booking_source)
  values(new_booking_id,'GF-'||upper(replace(new_booking_id::text,'-','')),customer_id,p_slot_id,zone.id,
    nullif(btrim(p_vehicle->>'reg'),''),nullif(btrim(p_vehicle->>'make'),''),nullif(btrim(p_vehicle->>'model'),''),
    concat_ws(', ',nullif(btrim(p_customer->>'address_line1'),''),nullif(btrim(p_customer->>'address_line2'),''),nullif(btrim(p_customer->>'city'),'')),
    upper(btrim(p_postcode)),nullif(btrim(p_notes),''),'AWAITING_BANK_PAYMENT',
    subtotal::integer,settings.fitting_fee_pence,zone.callout_fee_pence,total::integer,deposit::integer,(total-deposit)::integer,
    p_checkout_key,fingerprint,deadline,'online');
  update public.slot_holds set booking_id=new_booking_id where id=new_hold_id;
  insert into public.booking_items(booking_id,tyre_product_id,sku_snapshot,brand_snapshot,model_snapshot,size_snapshot,quantity,unit_price_pence,line_total_pence)
    select new_booking_id,p.id,p.sku,p.brand,p.model,p.width||'/'||p.profile||' R'||p.rim,c.quantity,i.selling_price_pence,
      (i.selling_price_pence::bigint*c.quantity)::integer
    from public.tyre_products p join public.inventory i on i.tyre_product_id=p.id
    join jsonb_to_recordset(quantities) as c(tyre_id uuid,quantity integer) on c.tyre_id=p.id order by p.id;
  insert into public.payments(booking_id,provider,payment_method,type,status,amount_pence,currency,reference,bank_details)
    select b.id,'manual','bank_transfer','deposit','pending',b.total_pence,'gbp',b.reference,
      jsonb_build_object('bank_name',settings.bank_name,'bank_account_name',settings.bank_account_name,
        'sort_code',settings.sort_code,'account_number',settings.account_number)
    from public.bookings b where b.id=new_booking_id;
  return query select b.id,b.reference,b.manage_token,b.status,b.bank_payment_expires_at,b.total_pence,b.deposit_pence,b.balance_pence
    from public.bookings b where b.id=new_booking_id;
end;
$$;

create function public.admin_reserve_phone_booking(p_actor_user_id uuid,p_session_id uuid,
  p_checkout_key uuid,p_slot_id uuid,p_items jsonb,p_customer jsonb,p_postcode text,p_vehicle jsonb,p_notes text)
returns table(booking_id uuid,reference text,manage_token uuid,status text,expires_at timestamptz,
  total_pence integer,deposit_pence integer,balance_pence integer)
language plpgsql security definer set search_path='' as $$
declare reserved record; existing public.bookings;
begin
  perform public.assert_bank_operator(p_actor_user_id,p_session_id);
  perform pg_advisory_xact_lock(hashtextextended(p_checkout_key::text,0));
  select * into existing from public.bookings b where b.checkout_key=p_checkout_key;
  if found and existing.booking_source is distinct from 'phone' then
    raise exception using errcode='P2005',message='checkout_key_reused'; end if;
  select * into reserved from public.reserve_booking_checkout(
    p_checkout_key,p_slot_id,p_items,p_customer,p_postcode,p_vehicle,p_notes);
  if existing.id is null then
    perform set_config('gforce.bank_action',jsonb_build_object('id',reserved.booking_id,'kind','phone')::text,true);
    update public.bookings set booking_source='phone' where id=reserved.booking_id;
    insert into public.audit_logs(admin_user_id,action,resource_type,resource_id,metadata)
      values(p_actor_user_id,'booking.phone_reserved','bookings',reserved.booking_id,jsonb_build_object('reference',reserved.reference));
    perform set_config('gforce.bank_action','',true);
  end if;
  return query select reserved.booking_id,reserved.reference,reserved.manage_token,reserved.status,
    reserved.expires_at,reserved.total_pence,reserved.deposit_pence,reserved.balance_pence;
end;
$$;

create function public.admin_claim_bank_email(p_actor_user_id uuid,p_session_id uuid,p_booking_id uuid)
returns public.email_outbox language plpgsql security definer set search_path='' as $$
declare b public.bookings; p public.payments; c public.customers; queued public.email_outbox; key text;
begin
  perform public.assert_bank_operator(p_actor_user_id,p_session_id);
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception using errcode='P3002',message='booking_not_found'; end if;
  if b.status<>'AWAITING_BANK_PAYMENT' or b.bank_payment_expires_at<=clock_timestamp() then
    raise exception using errcode='P3005',message='reservation_expired'; end if;
  select * into p from public.payments where booking_id=b.id and provider='manual' and status='pending';
  if not found then raise exception using errcode='P3004',message='wrong_booking_state'; end if;
  select * into c from public.customers where id=b.customer_id;
  if not found then raise exception using errcode='P3004',message='customer_missing'; end if;
  key := 'bank-instructions:'||b.id::text||':'||extract(epoch from b.bank_payment_expires_at)::text;
  insert into public.email_outbox(booking_id,deduplication_key,recipient,template,payload)
    values(b.id,key,c.email,'bank_instructions',jsonb_build_object('reference',b.reference,'amount_pence',p.amount_pence,
      'bank_details',p.bank_details,'expires_at',b.bank_payment_expires_at,'manage_token',b.manage_token))
    on conflict(deduplication_key) do nothing;
  select * into queued from public.email_outbox where deduplication_key=key for update;
  if queued.status='sent' then return queued; end if;
  if queued.status='processing' and queued.locked_at>clock_timestamp()-interval '2 minutes' then
    raise exception using errcode='P3007',message='email_in_progress'; end if;
  -- Resend retains idempotency keys for 24 hours. Do not retry ambiguous old sends past that guarantee.
  if queued.attempts>0 and queued.created_at<clock_timestamp()-interval '23 hours' then
    raise exception using errcode='P3008',message='email_requires_provider_reconciliation'; end if;
  update public.email_outbox set status='processing',attempts=attempts+1,locked_at=clock_timestamp(),last_error=null
    where id=queued.id returning * into queued;
  insert into public.audit_logs(admin_user_id,action,resource_type,resource_id,metadata)
    values(p_actor_user_id,'payment.instructions_requested','bookings',b.id,jsonb_build_object('outbox_id',queued.id,'attempt',queued.attempts));
  return queued;
end;
$$;
create function public.finish_bank_email(p_outbox_id uuid,p_attempt integer,p_message_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  update public.email_outbox set status=case when nullif(p_message_id,'') is null then 'failed' else 'sent' end,
    provider_message_id=nullif(p_message_id,''),sent_at=case when nullif(p_message_id,'') is null then null else clock_timestamp() end,
    last_error=case when nullif(p_message_id,'') is null then 'Provider delivery was not confirmed; retry uses the same idempotency key' else null end,
    locked_at=null where id=p_outbox_id and attempts=p_attempt and status='processing' and template='bank_instructions';
  get diagnostics changed=row_count;
  return changed=1;
end;
$$;

revoke all on function public.assert_bank_operator(uuid,uuid,boolean),public.guard_manual_payment(),
  public.owner_set_bank_settings(uuid,uuid,text,text,text,text,integer),
  public.admin_verify_bank_payment(uuid,uuid,uuid,integer),
  public.admin_extend_bank_window(uuid,uuid,uuid,integer,text,timestamptz),
  public.admin_reserve_phone_booking(uuid,uuid,uuid,uuid,jsonb,jsonb,text,jsonb,text),
  public.admin_claim_bank_email(uuid,uuid,uuid),public.finish_bank_email(uuid,integer,text)
  from public,anon,authenticated;
grant execute on function public.owner_set_bank_settings(uuid,uuid,text,text,text,text,integer),
  public.admin_verify_bank_payment(uuid,uuid,uuid,integer),
  public.admin_extend_bank_window(uuid,uuid,uuid,integer,text,timestamptz),
  public.admin_reserve_phone_booking(uuid,uuid,uuid,uuid,jsonb,jsonb,text,jsonb,text),
  public.admin_claim_bank_email(uuid,uuid,uuid),public.finish_bank_email(uuid,integer,text)
  to service_role;
