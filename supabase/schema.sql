-- ═══════════════════════════════════════════════════════════════
-- G FORCE TYRES — DATABASE SCHEMA
-- Run this once in the Supabase SQL Editor on a fresh project.
-- Safe to re-run: everything uses IF NOT EXISTS / CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ADMIN PROFILES — owner / admin role mappings
-- ─────────────────────────────────────────────────────────────
create table if not exists admin_profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  name       text not null,
  role       text not null check (role in ('owner', 'admin')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table admin_profiles enable row level security;

drop policy if exists "users read own admin profile" on admin_profiles;
create policy "users read own admin profile"
  on admin_profiles for select to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- TYRE INVENTORY
-- ─────────────────────────────────────────────────────────────
create table if not exists tyre_inventory (
  id            uuid primary key default gen_random_uuid(),
  brand         text not null,
  model         text not null,
  sku           text unique not null,
  width         integer not null,          -- 225
  profile       integer not null,          -- 45
  rim           integer not null,          -- 18
  load_index    text,                      -- 95
  speed_rating  text,                      -- Y
  is_run_flat   boolean not null default false,
  is_xl         boolean not null default false,
  season        text not null default 'summer'
                check (season in ('summer','all-season','winter')),
  tier          text not null default 'mid'
                check (tier in ('budget','mid','premium')),
  -- Money is stored in PENCE as integers. Never use floats for money.
  cost_price    integer not null,          -- 8500 = £85.00
  sell_price    integer not null,          -- 14900 = £149.00
  stock         integer not null default 0 check (stock >= 0),
  -- EU tyre label ratings
  wet_grip      text,                      -- A..E
  fuel_economy  text,                      -- A..E
  noise_db      integer,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- The tyre finder queries on this composite constantly.
create index if not exists idx_tyre_size
  on tyre_inventory (width, profile, rim)
  where active = true;

-- ─────────────────────────────────────────────────────────────
-- SERVICE ZONES — which postcodes G Force will travel to
-- ─────────────────────────────────────────────────────────────
create table if not exists service_zones (
  id              uuid primary key default gen_random_uuid(),
  postcode_prefix text not null unique,     -- 'E14', 'SW1', 'N1'
  zone_name       text not null,
  callout_charge  integer not null default 0, -- pence
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- FITTERS
-- ─────────────────────────────────────────────────────────────
create table if not exists fitters (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- BOOKING SLOTS — admin-defined availability windows
-- ─────────────────────────────────────────────────────────────
create table if not exists booking_slots (
  id            uuid primary key default gen_random_uuid(),
  slot_date     date not null,
  start_time    time not null,
  end_time      time not null,
  max_bookings  integer not null default 1 check (max_bookings > 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (slot_date, start_time)
);

create index if not exists idx_slots_date
  on booking_slots (slot_date)
  where active = true;

-- ─────────────────────────────────────────────────────────────
-- CUSTOMERS — guest checkout, no accounts
-- ─────────────────────────────────────────────────────────────
create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  email         text not null unique,
  phone         text,
  address_line1 text,
  address_line2 text,
  city          text,
  postcode      text,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────────────────────────────
create table if not exists bookings (
  id                       uuid primary key default gen_random_uuid(),
  booking_ref              text unique not null,   -- GF-1042
  manage_token             uuid unique not null default gen_random_uuid(),
  customer_id              uuid references customers(id) on delete set null,
  slot_id                  uuid references booking_slots(id) on delete set null,
  fitter_id                uuid references fitters(id) on delete set null,

  vehicle_reg              text,
  vehicle_make             text,
  vehicle_model            text,
  vehicle_derivative       text,

  fitting_address          text,
  fitting_postcode         text,
  customer_notes           text,
  admin_notes              text,

  status                   text not null default 'pending_payment'
    check (status in (
      'pending_payment','confirmed','tyres_reserved','fitter_assigned',
      'en_route','completed','cancelled','refunded','payment_failed'
    )),

  -- All money in pence
  tyres_total              integer not null default 0,
  fitting_fee              integer not null default 0,
  callout_charge           integer not null default 0,
  total_amount             integer not null default 0,
  deposit_amount           integer not null default 0,
  balance_due              integer not null default 0,

  stripe_payment_intent_id text,
  stripe_charge_id         text,
  deposit_paid_at          timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_bookings_status  on bookings (status);
create index if not exists idx_bookings_slot    on bookings (slot_id);
create index if not exists idx_bookings_pi      on bookings (stripe_payment_intent_id);
create index if not exists idx_bookings_token   on bookings (manage_token);

-- ─────────────────────────────────────────────────────────────
-- BOOKING LINE ITEMS
-- Price is SNAPSHOTTED at purchase so later price changes
-- never rewrite historical orders.
-- ─────────────────────────────────────────────────────────────
create table if not exists booking_items (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  tyre_id     uuid references tyre_inventory(id) on delete set null,
  tyre_label  text not null,              -- "Michelin Pilot Sport 5 225/45 R18"
  quantity    integer not null check (quantity > 0),
  unit_price  integer not null,           -- pence, snapshot
  line_total  integer not null            -- pence, snapshot
);

create index if not exists idx_items_booking on booking_items (booking_id);

-- ─────────────────────────────────────────────────────────────
-- SLOT HOLDS — 15-minute soft lock during checkout
-- ─────────────────────────────────────────────────────────────
create table if not exists slot_holds (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null references booking_slots(id) on delete cascade,
  session_token text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_holds_slot    on slot_holds (slot_id);
create index if not exists idx_holds_expires on slot_holds (expires_at);

-- ─────────────────────────────────────────────────────────────
-- VRM CACHE — never pay OneAutoAPI twice for the same plate
-- ─────────────────────────────────────────────────────────────
create table if not exists vrm_cache (
  id            uuid primary key default gen_random_uuid(),
  registration  text unique not null,      -- normalised, no spaces, uppercase
  payload       jsonb not null,            -- full normalised lookup result
  cached_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- RATE LIMITS — IP throttling without Redis
-- ─────────────────────────────────────────────────────────────
create table if not exists rate_limits (
  id          uuid primary key default gen_random_uuid(),
  bucket_key  text not null,               -- 'vrm:1.2.3.4'
  window_start timestamptz not null default now(),
  hits        integer not null default 1
);

create index if not exists idx_rate_bucket on rate_limits (bucket_key, window_start);

-- ─────────────────────────────────────────────────────────────
-- INTEREST REGISTRATIONS — out-of-area email capture
-- ─────────────────────────────────────────────────────────────
create table if not exists interest_registrations (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  postcode   text not null,
  source     text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- SETTINGS — single-row config table
-- ─────────────────────────────────────────────────────────────
create table if not exists app_settings (
  id                  integer primary key default 1 check (id = 1),
  deposit_mode        text not null default 'fixed' check (deposit_mode in ('fixed','percent')),
  deposit_fixed       integer not null default 5000,  -- £50 in pence
  deposit_percent     integer not null default 20,
  fitting_fee         integer not null default 2000,  -- £20 per booking
  job_duration_mins   integer not null default 60,
  cancellation_policy text not null default 'Free cancellation up to 48 hours before your appointment.',
  business_phone      text,
  updated_at          timestamptz not null default now()
);

insert into app_settings (id) values (1) on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor      text,                          -- admin email or 'system'
  action     text not null,
  entity     text,
  entity_id  uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_touch on bookings;
create trigger bookings_touch
  before update on bookings
  for each row execute function touch_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- BOOKING REFERENCE GENERATOR
-- Produces GF-1000, GF-1001, ... sequentially.
-- ═══════════════════════════════════════════════════════════════
create sequence if not exists booking_ref_seq start 1000;

create or replace function next_booking_ref()
returns text language sql as $$
  select 'GF-' || nextval('booking_ref_seq')::text;
$$;

-- ═══════════════════════════════════════════════════════════════
-- SLOT AVAILABILITY
-- Counts live bookings + unexpired holds against slot capacity.
-- ═══════════════════════════════════════════════════════════════
create or replace function slot_remaining(p_slot_id uuid)
returns integer language plpgsql stable as $$
declare
  v_max   integer;
  v_taken integer;
begin
  select max_bookings into v_max
  from booking_slots
  where id = p_slot_id and active = true;

  if v_max is null then
    return 0;
  end if;

  select
    (select count(*) from bookings
       where slot_id = p_slot_id
         and status not in ('cancelled','refunded','payment_failed'))
  + (select count(*) from slot_holds
       where slot_id = p_slot_id
         and expires_at > now())
  into v_taken;

  return greatest(v_max - v_taken, 0);
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- ATOMIC HOLD CREATION
-- Locks the slot row so two people can't take the last slot
-- in the same millisecond.
-- ═══════════════════════════════════════════════════════════════
create or replace function create_slot_hold(
  p_slot_id       uuid,
  p_session_token text,
  p_minutes       integer default 15
)
returns table (hold_id uuid, expires_at timestamptz)
language plpgsql as $$
declare
  v_remaining integer;
  v_hold_id   uuid;
  v_expires   timestamptz;
begin
  -- Serialise concurrent attempts on this slot
  perform 1 from booking_slots where id = p_slot_id for update;

  select slot_remaining(p_slot_id) into v_remaining;

  if v_remaining <= 0 then
    raise exception 'SLOT_FULL';
  end if;

  -- One hold per session per slot
  delete from slot_holds
   where slot_id = p_slot_id and session_token = p_session_token;

  v_expires := now() + (p_minutes || ' minutes')::interval;

  insert into slot_holds (slot_id, session_token, expires_at)
  values (p_slot_id, p_session_token, v_expires)
  returning id into v_hold_id;

  return query select v_hold_id, v_expires;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- CONFIRM BOOKING (called by the Stripe webhook)
-- Idempotent: running it twice will not double-decrement stock.
-- ═══════════════════════════════════════════════════════════════
create or replace function confirm_booking_paid(
  p_payment_intent_id text,
  p_charge_id         text
)
returns uuid language plpgsql as $$
declare
  v_booking bookings%rowtype;
  v_item    record;
begin
  select * into v_booking
  from bookings
  where stripe_payment_intent_id = p_payment_intent_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  -- Already processed — do nothing, return successfully.
  if v_booking.status <> 'pending_payment' then
    return v_booking.id;
  end if;

  -- Decrement stock for each line item
  for v_item in
    select tyre_id, quantity from booking_items where booking_id = v_booking.id
  loop
    if v_item.tyre_id is not null then
      update tyre_inventory
         set stock = greatest(stock - v_item.quantity, 0)
       where id = v_item.tyre_id;
    end if;
  end loop;

  update bookings
     set status                = 'confirmed',
         stripe_charge_id      = p_charge_id,
         deposit_paid_at       = now()
   where id = v_booking.id;

  -- Release the hold; the booking itself now occupies the slot
  delete from slot_holds where slot_id = v_booking.slot_id;

  insert into audit_log (actor, action, entity, entity_id, metadata)
  values ('system', 'booking_confirmed', 'booking', v_booking.id,
          jsonb_build_object('payment_intent', p_payment_intent_id));

  return v_booking.id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RESTORE STOCK ON REFUND
-- ═══════════════════════════════════════════════════════════════
create or replace function refund_booking(p_payment_intent_id text)
returns uuid language plpgsql as $$
declare
  v_booking bookings%rowtype;
  v_item    record;
begin
  select * into v_booking
  from bookings
  where stripe_payment_intent_id = p_payment_intent_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.status = 'refunded' then
    return v_booking.id;
  end if;

  for v_item in
    select tyre_id, quantity from booking_items where booking_id = v_booking.id
  loop
    if v_item.tyre_id is not null then
      update tyre_inventory set stock = stock + v_item.quantity where id = v_item.tyre_id;
    end if;
  end loop;

  update bookings set status = 'refunded' where id = v_booking.id;

  insert into audit_log (actor, action, entity, entity_id)
  values ('system', 'booking_refunded', 'booking', v_booking.id);

  return v_booking.id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- CLEANUP EXPIRED HOLDS
-- Schedule via pg_cron or call from a Supabase Edge Function.
--   select cron.schedule('purge-holds','*/5 * * * *','select purge_expired_holds()');
-- ═══════════════════════════════════════════════════════════════
create or replace function purge_expired_holds()
returns integer language plpgsql as $$
declare v_deleted integer;
begin
  delete from slot_holds where expires_at < now();
  get diagnostics v_deleted = row_count;

  delete from rate_limits where window_start < now() - interval '1 hour';

  return v_deleted;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
--
-- Model: the browser (anon key) can ONLY read public catalogue data.
-- Every write, and every read of customer data, goes through a
-- Next.js API route using the service key. This is why there is no
-- "anon can insert booking" policy — the browser never writes.
-- ═══════════════════════════════════════════════════════════════
alter table tyre_inventory        enable row level security;
alter table booking_slots         enable row level security;
alter table service_zones         enable row level security;
alter table bookings              enable row level security;
alter table booking_items         enable row level security;
alter table customers             enable row level security;
alter table slot_holds            enable row level security;
alter table vrm_cache             enable row level security;
alter table rate_limits           enable row level security;
alter table interest_registrations enable row level security;
alter table app_settings          enable row level security;
alter table audit_log             enable row level security;
alter table fitters               enable row level security;

-- Public catalogue reads
drop policy if exists "public reads active tyres" on tyre_inventory;
create policy "public reads active tyres"
  on tyre_inventory for select to anon, authenticated
  using (active = true);

drop policy if exists "public reads active slots" on booking_slots;
create policy "public reads active slots"
  on booking_slots for select to anon, authenticated
  using (active = true);

drop policy if exists "public reads active zones" on service_zones;
create policy "public reads active zones"
  on service_zones for select to anon, authenticated
  using (active = true);

drop policy if exists "public reads settings" on app_settings;
create policy "public reads settings"
  on app_settings for select to anon, authenticated
  using (true);

-- Everything else: no anon policy at all.
-- With RLS enabled and no policy, anon access is denied by default.
-- The service key bypasses RLS entirely for server-side routes.

-- ═══════════════════════════════════════════════════════════════
-- DONE. Next: run seed.sql for test data.
-- ═══════════════════════════════════════════════════════════════
