-- Temporary bank-payment reservations live in holds, not inventory.reserved_qty.
-- reserved_qty remains the pre-existing non-expiring operational allocation.
-- Every availability decision excludes expired holds directly: no cron dependency.
alter table public.business_settings add column bank_payment_window_minutes integer
  constraint business_settings_bank_window_check check (bank_payment_window_minutes between 1 and 10080);
-- Deliberately no default: the owner must choose the business payment window.
alter table public.bookings add column checkout_key uuid unique;
alter table public.bookings add column checkout_fingerprint text;
alter table public.bookings add column bank_payment_expires_at timestamptz;
alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (status in (
  'pending_payment','confirmed','tyres_reserved','fitter_assigned','en_route','completed',
  'cancelled','refunded','payment_failed','AWAITING_BANK_PAYMENT','EXPIRED'));
alter table public.bookings add constraint bookings_bank_reservation_check check (
  (checkout_key is null and checkout_fingerprint is null and bank_payment_expires_at is null)
  or (checkout_key is not null and checkout_fingerprint is not null and bank_payment_expires_at is not null
    and subtotal_pence + fitting_fee_pence::bigint + callout_fee_pence = total_pence
    and deposit_pence + balance_pence::bigint = total_pence));
alter table public.bookings add constraint bookings_awaiting_bank_check check (
  status <> 'AWAITING_BANK_PAYMENT' or checkout_key is not null);
alter table public.slot_holds add column booking_id uuid unique references public.bookings(id) on delete restrict;
create index idx_bookings_bank_expiry on public.bookings(bank_payment_expires_at)
  where status = 'AWAITING_BANK_PAYMENT';
create index idx_inventory_holds_live_product on public.inventory_holds(tyre_product_id,expires_at);

create function public.live_inventory_held(p_product_id uuid) returns bigint
language sql volatile security definer set search_path = '' as $$
  select coalesce(sum(h.quantity),0) from public.inventory_holds h
  join public.slot_holds s on s.id=h.slot_hold_id
  left join public.bookings b on b.id=s.booking_id
  where h.tyre_product_id=p_product_id and h.expires_at>clock_timestamp()
    and s.expires_at>clock_timestamp()
    and (s.booking_id is null or (b.status='AWAITING_BANK_PAYMENT' and b.bank_payment_expires_at>clock_timestamp()));
$$;
create function public.slot_consumption(p_slot_id uuid) returns bigint
language sql volatile security definer set search_path = '' as $$
  select (select count(*) from public.bookings b where b.slot_id=p_slot_id
    and b.status not in ('pending_payment','cancelled','refunded','payment_failed','AWAITING_BANK_PAYMENT','EXPIRED'))
    + (select count(*) from public.slot_holds s left join public.bookings b on b.id=s.booking_id
      where s.slot_id=p_slot_id and s.expires_at>clock_timestamp()
      and (s.booking_id is null or (b.status='AWAITING_BANK_PAYMENT' and b.bank_payment_expires_at>clock_timestamp())));
$$;
create function public.expire_unpaid_bookings() returns integer
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  -- No slot/inventory locks are required to expire: time predicates already
  -- released those resources. SKIP LOCKED also permits overlapping readers.
  with expired as (select id from public.bookings
    where status='AWAITING_BANK_PAYMENT' and bank_payment_expires_at<=clock_timestamp()
    order by id for update skip locked)
  update public.bookings b set status='EXPIRED' from expired e where b.id=e.id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create function public.guard_booking_items() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception using errcode='55000', message='Booking items are immutable'; end;
$$;
create trigger booking_items_immutable before update or delete on public.booking_items
  for each row execute function public.guard_booking_items();

create function public.guard_bank_booking() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.checkout_key is not null then
    if (to_jsonb(new)-'status'-'updated_at') is distinct from (to_jsonb(old)-'status'-'updated_at') then
      raise exception using errcode='55000', message='Bank reservation terms are immutable';
    end if;
    if new.status is distinct from old.status and not
      (old.status='AWAITING_BANK_PAYMENT' and new.status='EXPIRED' and old.bank_payment_expires_at<=clock_timestamp()) then
      raise exception using errcode='55000', message='Bank payment confirmation requires a separate verified transaction';
    end if;
  end if;
  return new;
end;
$$;
create trigger bookings_bank_terms_immutable before update on public.bookings
  for each row execute function public.guard_bank_booking();

create function public.guard_inventory_holds_stock() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stock_qty::bigint < new.reserved_qty::bigint + public.live_inventory_held(new.tyre_product_id) then
    raise exception using errcode='23514', message='Stock cannot be reduced below live reservations';
  end if;
  return new;
end;
$$;
create trigger inventory_live_reservations before update on public.inventory
  for each row execute function public.guard_inventory_holds_stock();
create function public.guard_slot_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.capacity < public.slot_consumption(new.id) then
    raise exception using errcode='23514', message='Capacity cannot be reduced below live reservations';
  end if;
  return new;
end;
$$;
create trigger booking_slots_live_reservations before update on public.booking_slots
  for each row execute function public.guard_slot_capacity();

create function public.reserve_booking_checkout(
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
  deposit := case when settings.deposit_mode='fixed' then least(settings.deposit_value::bigint,total)
    else (total*settings.deposit_value+50)/100 end;
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
    checkout_key,checkout_fingerprint,bank_payment_expires_at)
  values(new_booking_id,'GF-'||upper(replace(new_booking_id::text,'-','')),customer_id,p_slot_id,zone.id,
    nullif(btrim(p_vehicle->>'reg'),''),nullif(btrim(p_vehicle->>'make'),''),nullif(btrim(p_vehicle->>'model'),''),
    concat_ws(', ',nullif(btrim(p_customer->>'address_line1'),''),nullif(btrim(p_customer->>'address_line2'),''),nullif(btrim(p_customer->>'city'),'')),
    upper(btrim(p_postcode)),nullif(btrim(p_notes),''),'AWAITING_BANK_PAYMENT',
    subtotal::integer,settings.fitting_fee_pence,zone.callout_fee_pence,total::integer,deposit::integer,(total-deposit)::integer,
    p_checkout_key,fingerprint,deadline);
  update public.slot_holds set booking_id=new_booking_id where id=new_hold_id;
  insert into public.booking_items(booking_id,tyre_product_id,sku_snapshot,brand_snapshot,model_snapshot,size_snapshot,quantity,unit_price_pence,line_total_pence)
    select new_booking_id,p.id,p.sku,p.brand,p.model,p.width||'/'||p.profile||' R'||p.rim,c.quantity,i.selling_price_pence,
      (i.selling_price_pence::bigint*c.quantity)::integer
    from public.tyre_products p join public.inventory i on i.tyre_product_id=p.id
    join jsonb_to_recordset(quantities) as c(tyre_id uuid,quantity integer) on c.tyre_id=p.id order by p.id;
  return query select b.id,b.reference,b.manage_token,b.status,b.bank_payment_expires_at,b.total_pence,b.deposit_pence,b.balance_pence
    from public.bookings b where b.id=new_booking_id;
end;
$$;

revoke all on function public.reserve_booking_checkout(uuid,uuid,jsonb,jsonb,text,jsonb,text),
  public.expire_unpaid_bookings(),public.live_inventory_held(uuid),public.slot_consumption(uuid),
  public.guard_booking_items(),public.guard_bank_booking(),public.guard_inventory_holds_stock(),public.guard_slot_capacity()
  from public,anon,authenticated;
grant execute on function public.reserve_booking_checkout(uuid,uuid,jsonb,jsonb,text,jsonb,text),
  public.expire_unpaid_bookings(),public.live_inventory_held(uuid),public.slot_consumption(uuid)
  to service_role;
