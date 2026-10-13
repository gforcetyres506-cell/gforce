BEGIN;
-- REVIEW DRAFT ONLY. Never execute on a live project without separate approval.
-- Run once, in maintenance mode, on the exact legacy shape from origin/main.
-- Every source table is copied, verified and retained with its original OID.
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';
SELECT pg_catalog.pg_advisory_xact_lock(70824019);

DO $preflight$
DECLARE missing text; r record;
BEGIN
  IF to_regnamespace('legacy_backup_20261013') IS NOT NULL
    OR to_regnamespace('legacy_source_20261013') IS NOT NULL THEN
    RAISE EXCEPTION 'Reconciliation archive already exists; refusing to overwrite or rerun';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regclass('auth.sessions') IS NULL THEN
    RAISE EXCEPTION 'Supabase Auth catalogue is missing';
  END IF;
  -- Extension-owned objects are infrastructure, never archived as business data.
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('p','f','v','m') AND NOT EXISTS (
      SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')) THEN
    RAISE EXCEPTION 'Public partitions, foreign tables or views require a separately reviewed mapping';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typtype IN ('e','d','r') AND NOT EXISTS (
      SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')) THEN
    RAISE EXCEPTION 'Custom enum/domain/range requires explicit review';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('tyre_products','inventory','business_settings','audit_logs',
      'payments','webhook_events','availability_rules','blocked_dates','special_dates','inventory_holds','email_outbox')) THEN
    RAISE EXCEPTION 'Mixed legacy/canonical schema: do not blindly replay this reconciliation';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication p WHERE p.puballtables) OR EXISTS (
    SELECT 1 FROM pg_publication_rel p JOIN pg_class c ON c.oid=p.prrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') THEN
    RAISE EXCEPTION 'Legacy publication membership needs a reviewed Realtime cutover';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint f JOIN pg_class src ON src.oid=f.conrelid
    JOIN pg_namespace sn ON sn.oid=src.relnamespace JOIN pg_class dst ON dst.oid=f.confrelid
    JOIN pg_namespace dn ON dn.oid=dst.relnamespace
    WHERE f.contype='f' AND dn.nspname='public' AND sn.nspname<>'public') THEN
    RAISE EXCEPTION 'External foreign key into legacy public tables requires review';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
    JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE NOT t.tgisinternal
    AND n.nspname<>'public' AND pn.nspname='public') THEN
    RAISE EXCEPTION 'External trigger depends on a legacy public function';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_rewrite w JOIN pg_class v ON v.oid=w.ev_class
    JOIN pg_namespace vn ON vn.oid=v.relnamespace JOIN pg_depend d ON d.classid='pg_rewrite'::regclass AND d.objid=w.oid
    JOIN pg_class target ON d.refclassid='pg_class'::regclass AND target.oid=d.refobjid
    JOIN pg_namespace tn ON tn.oid=target.relnamespace WHERE vn.nspname<>'public' AND tn.nspname='public'
    AND NOT EXISTS(SELECT 1 FROM pg_depend e WHERE e.classid='pg_class'::regclass AND e.objid=target.oid AND e.deptype='e')) THEN
    RAISE EXCEPTION 'External view depends on a legacy public table';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind<>'f' AND NOT EXISTS (
      SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')) THEN
    RAISE EXCEPTION 'Legacy procedure/aggregate/window function requires explicit review';
  END IF;
  -- Exact column/type shape; extra columns on mapped tables also stop the cutover.
  WITH expected(table_name,column_name,type_name) AS (VALUES
('admin_profiles','id','uuid'),
('admin_profiles','user_id','uuid'),
('admin_profiles','name','text'),
('admin_profiles','role','text'),
('admin_profiles','active','boolean'),
('admin_profiles','created_at','timestamp with time zone'),
('admin_profiles','updated_at','timestamp with time zone'),
('tyre_inventory','id','uuid'),
('tyre_inventory','brand','text'),
('tyre_inventory','model','text'),
('tyre_inventory','sku','text'),
('tyre_inventory','width','integer'),
('tyre_inventory','profile','integer'),
('tyre_inventory','rim','integer'),
('tyre_inventory','load_index','text'),
('tyre_inventory','speed_rating','text'),
('tyre_inventory','is_run_flat','boolean'),
('tyre_inventory','is_xl','boolean'),
('tyre_inventory','season','text'),
('tyre_inventory','tier','text'),
('tyre_inventory','cost_price','integer'),
('tyre_inventory','sell_price','integer'),
('tyre_inventory','stock','integer'),
('tyre_inventory','wet_grip','text'),
('tyre_inventory','fuel_economy','text'),
('tyre_inventory','noise_db','integer'),
('tyre_inventory','active','boolean'),
('tyre_inventory','created_at','timestamp with time zone'),
('service_zones','id','uuid'),
('service_zones','postcode_prefix','text'),
('service_zones','zone_name','text'),
('service_zones','callout_charge','integer'),
('service_zones','active','boolean'),
('service_zones','created_at','timestamp with time zone'),
('fitters','id','uuid'),
('fitters','name','text'),
('fitters','phone','text'),
('fitters','active','boolean'),
('fitters','created_at','timestamp with time zone'),
('booking_slots','id','uuid'),
('booking_slots','slot_date','date'),
('booking_slots','start_time','time without time zone'),
('booking_slots','end_time','time without time zone'),
('booking_slots','max_bookings','integer'),
('booking_slots','active','boolean'),
('booking_slots','created_at','timestamp with time zone'),
('customers','id','uuid'),
('customers','name','text'),
('customers','email','text'),
('customers','phone','text'),
('customers','address_line1','text'),
('customers','address_line2','text'),
('customers','city','text'),
('customers','postcode','text'),
('customers','created_at','timestamp with time zone'),
('bookings','id','uuid'),
('bookings','booking_ref','text'),
('bookings','manage_token','uuid'),
('bookings','customer_id','uuid'),
('bookings','slot_id','uuid'),
('bookings','fitter_id','uuid'),
('bookings','vehicle_reg','text'),
('bookings','vehicle_make','text'),
('bookings','vehicle_model','text'),
('bookings','vehicle_derivative','text'),
('bookings','fitting_address','text'),
('bookings','fitting_postcode','text'),
('bookings','customer_notes','text'),
('bookings','admin_notes','text'),
('bookings','status','text'),
('bookings','tyres_total','integer'),
('bookings','fitting_fee','integer'),
('bookings','callout_charge','integer'),
('bookings','total_amount','integer'),
('bookings','deposit_amount','integer'),
('bookings','balance_due','integer'),
('bookings','stripe_payment_intent_id','text'),
('bookings','stripe_charge_id','text'),
('bookings','deposit_paid_at','timestamp with time zone'),
('bookings','created_at','timestamp with time zone'),
('bookings','updated_at','timestamp with time zone'),
('booking_items','id','uuid'),
('booking_items','booking_id','uuid'),
('booking_items','tyre_id','uuid'),
('booking_items','tyre_label','text'),
('booking_items','quantity','integer'),
('booking_items','unit_price','integer'),
('booking_items','line_total','integer'),
('slot_holds','id','uuid'),
('slot_holds','slot_id','uuid'),
('slot_holds','session_token','text'),
('slot_holds','expires_at','timestamp with time zone'),
('slot_holds','created_at','timestamp with time zone'),
('vrm_cache','id','uuid'),
('vrm_cache','registration','text'),
('vrm_cache','payload','jsonb'),
('vrm_cache','cached_at','timestamp with time zone'),
('rate_limits','id','uuid'),
('rate_limits','bucket_key','text'),
('rate_limits','window_start','timestamp with time zone'),
('rate_limits','hits','integer'),
('interest_registrations','id','uuid'),
('interest_registrations','email','text'),
('interest_registrations','postcode','text'),
('interest_registrations','source','text'),
('interest_registrations','created_at','timestamp with time zone'),
('app_settings','id','integer'),
('app_settings','deposit_mode','text'),
('app_settings','deposit_fixed','integer'),
('app_settings','deposit_percent','integer'),
('app_settings','fitting_fee','integer'),
('app_settings','job_duration_mins','integer'),
('app_settings','cancellation_policy','text'),
('app_settings','business_phone','text'),
('app_settings','updated_at','timestamp with time zone'),
('audit_log','id','uuid'),
('audit_log','actor','text'),
('audit_log','action','text'),
('audit_log','entity','text'),
('audit_log','entity_id','uuid'),
('audit_log','metadata','jsonb'),
('audit_log','created_at','timestamp with time zone')
  ), actual AS (
    SELECT c.relname::text table_name,a.attname::text column_name,format_type(a.atttypid,a.atttypmod) type_name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped
    AND c.relname IN (SELECT table_name FROM expected)
  ), differences AS (
    (SELECT * FROM expected EXCEPT SELECT * FROM actual) UNION ALL
    (SELECT * FROM actual EXCEPT SELECT * FROM expected)
  ) SELECT string_agg(DISTINCT table_name,', ' ORDER BY table_name) INTO missing FROM differences;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Unreviewed legacy column/type shape in tables: %',missing; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.admin_profiles WHERE role='owner' AND active) THEN
    RAISE EXCEPTION 'Existing active owner required; never invent or elevate an owner';
  END IF;
  -- Freeze all table writes before the snapshot. Auth locks prevent identity
  -- churn from weakening the preservation assertions; Auth itself is not copied.
  LOCK TABLE auth.users,auth.sessions IN SHARE MODE;
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND NOT EXISTS (
      SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e') ORDER BY c.relname LOOP
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',r.relname);
  END LOOP;
END;
$preflight$;

CREATE SCHEMA legacy_backup_20261013;
CREATE SCHEMA legacy_source_20261013;
REVOKE ALL ON SCHEMA legacy_backup_20261013,legacy_source_20261013 FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA legacy_backup_20261013 REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA legacy_source_20261013 REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE legacy_backup_20261013.reconciliation_manifest (
  table_name text PRIMARY KEY,source_count bigint NOT NULL,source_oid oid NOT NULL,
  source_fingerprint text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE legacy_backup_20261013.auth_attestation (
  table_name text PRIMARY KEY,source_count bigint NOT NULL,source_fingerprint text NOT NULL
);
-- Hashes only: do not copy Auth identities, passwords, sessions or JWTs.
INSERT INTO legacy_backup_20261013.auth_attestation
SELECT 'users',count(*),md5(coalesce(string_agg(md5(to_jsonb(u)::text),'' ORDER BY u.id),'')) FROM auth.users u
UNION ALL
SELECT 'sessions',count(*),md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' ORDER BY s.id),'')) FROM auth.sessions s;

DO $backup$
DECLARE r record; cols text; n bigint; fingerprint text; copied text;
BEGIN
  FOR r IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND NOT EXISTS (
      SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e') ORDER BY c.relname LOOP
    IF r.relname IN ('reconciliation_manifest','auth_attestation') THEN
      RAISE EXCEPTION 'Reserved backup metadata name conflicts with a business table'; END IF;
    EXECUTE format('CREATE TABLE legacy_backup_20261013.%I (LIKE public.%I INCLUDING ALL)',r.relname,r.relname);
    SELECT string_agg(format('%I',attname),',' ORDER BY attnum) INTO cols FROM pg_attribute
      WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped AND attgenerated='';
    EXECUTE format('INSERT INTO legacy_backup_20261013.%I (%s) OVERRIDING SYSTEM VALUE SELECT %s FROM public.%I',r.relname,cols,cols,r.relname);
    EXECUTE format('SELECT count(*),md5(coalesce(string_agg(h,'''' ORDER BY h),'''')) FROM (SELECT md5(to_jsonb(t)::text) h FROM public.%I t) s',r.relname) INTO n,fingerprint;
    EXECUTE format('SELECT md5(coalesce(string_agg(h,'''' ORDER BY h),'''')) FROM (SELECT md5(to_jsonb(t)::text) h FROM legacy_backup_20261013.%I t) s',r.relname) INTO copied;
    IF copied IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Backup content mismatch: %',r.relname; END IF;
    INSERT INTO legacy_backup_20261013.reconciliation_manifest(table_name,source_count,source_oid,source_fingerprint)
      VALUES(r.relname,n,r.oid,fingerprint);
    EXECUTE format('ALTER TABLE legacy_backup_20261013.%I ENABLE ROW LEVEL SECURITY',r.relname);
  END LOOP;
END;
$backup$;

-- Preserve original table OIDs, PKs, FKs, indexes, triggers and extra tables.
-- Moving originals is intentional: CREATE TABLE IF NOT EXISTS over a legacy
-- table cannot establish canonical columns, constraints or safe grants.
DO $archive$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure::text signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS (
      SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') LOOP
    EXECUTE format('ALTER FUNCTION %s SET SCHEMA legacy_source_20261013',r.signature);
  END LOOP;
  FOR r IN SELECT table_name FROM legacy_backup_20261013.reconciliation_manifest ORDER BY table_name LOOP
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA legacy_source_20261013',r.table_name);
  END LOOP;
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='S' AND NOT EXISTS (
      SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e') LOOP
    EXECUTE format('ALTER SEQUENCE public.%I SET SCHEMA legacy_source_20261013',r.relname);
  END LOOP;
END;
$archive$;
REVOKE ALL ON ALL TABLES IN SCHEMA legacy_backup_20261013,legacy_source_20261013 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA legacy_backup_20261013,legacy_source_20261013 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA legacy_source_20261013 FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE legacy_backup_20261013.reconciliation_manifest ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_backup_20261013.auth_attestation ENABLE ROW LEVEL SECURITY;
-- PostgreSQL object ownership remains the migration owner. Browser/server
-- roles cannot use either archive schema, even with legacy permissive policies.

-- FROZEN CANONICAL DDL: 001_extensions.sql; source SHA256 9a668f2e5c3620e6e4eb7ee03362ad73e7bcfea66c204671e6b7af4c2e7d4985
-- Core extensions and shared trigger helpers.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- FROZEN CANONICAL DDL: 002_admin_profiles.sql; source SHA256 551adb2d235ef77b27368edd17406bbe3f156936075386610211505d37e230f5
create table if not exists public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('owner', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists admin_profiles_set_updated_at on public.admin_profiles;
create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();


-- FROZEN CANONICAL DDL: 003_customers.sql; source SHA256 0b6001644a9536aa45bec80434b3b8d10e174f193c0ccaa2f3134c6231e4cf1a
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();


-- FROZEN CANONICAL DDL: 004_service_zones.sql; source SHA256 5aa52fbdbd1b3c66eeb8f3ad2cf362826d82cdaca3debc140f26dfdf1f7f04cd
create table if not exists public.service_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  postcode_prefix text not null unique,
  callout_fee_pence integer not null default 0 check (callout_fee_pence >= 0),
  active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now()
);


-- FROZEN CANONICAL DDL: 005_catalogue.sql; source SHA256 174aa162ffbb9407466332f93e009ea02586c1d4dbe305c6816bdc9680771052
create table if not exists public.tyre_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  brand text not null,
  model text not null,
  width integer not null check (width > 0),
  profile integer not null check (profile > 0),
  rim integer not null check (rim > 0),
  load_index text,
  speed_rating text,
  run_flat boolean not null default false,
  extra_load boolean not null default false,
  season text not null check (season in ('summer', 'all-season', 'winter')),
  tier text not null check (tier in ('budget', 'mid', 'premium')),
  wet_grip_rating text,
  fuel_efficiency_rating text,
  noise_db integer check (noise_db is null or noise_db >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  tyre_product_id uuid not null unique references public.tyre_products(id) on delete cascade,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  reserved_qty integer not null default 0 check (reserved_qty >= 0 and reserved_qty <= stock_qty),
  cost_price_pence integer not null check (cost_price_pence >= 0),
  selling_price_pence integer not null check (selling_price_pence >= 0),
  supplier_sku text,
  low_stock_threshold integer not null default 2 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now()
);

drop trigger if exists tyre_products_set_updated_at on public.tyre_products;
create trigger tyre_products_set_updated_at
before update on public.tyre_products
for each row execute function public.set_updated_at();

drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at
before update on public.inventory
for each row execute function public.set_updated_at();


-- FROZEN CANONICAL DDL: 006_availability.sql; source SHA256 04e5529cbcded17e1e764dbb1c1196fd68c3b844de15eb889b064c830e1e3644
create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_duration_minutes integer not null check (slot_duration_minutes > 0),
  capacity integer not null check (capacity > 0),
  active boolean not null default true,
  check (end_time > start_time)
);

create table if not exists public.booking_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_at time not null,
  end_at time not null,
  capacity integer not null check (capacity > 0),
  active boolean not null default true,
  blocked_reason text,
  created_at timestamptz not null default now(),
  unique (date, start_at, end_at),
  check (end_at > start_at)
);

create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);


-- FROZEN CANONICAL DDL: 007_booking_resources.sql; source SHA256 ca368b6dac6e104c820792e42c0f60430d745c4c205f7b98705c6b345594bd29
create table if not exists public.slot_holds (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.booking_slots(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_holds (
  id uuid primary key default gen_random_uuid(),
  slot_hold_id uuid not null references public.slot_holds(id) on delete cascade,
  tyre_product_id uuid not null references public.tyre_products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (slot_hold_id, tyre_product_id)
);


-- FROZEN CANONICAL DDL: 008_bookings.sql; source SHA256 9f60bb705a75f604637913115f44acf36361a1af9b670c1a5ae712dcea2b08ac
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  manage_token uuid not null unique default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  slot_id uuid references public.booking_slots(id) on delete restrict,
  fitter_id uuid,
  service_zone_id uuid references public.service_zones(id) on delete set null,
  registration text,
  vehicle_make text,
  vehicle_model text,
  vehicle_derivative text,
  fitting_address text not null,
  postcode text not null,
  status text not null default 'pending_payment' check (
    status in (
      'pending_payment', 'confirmed', 'tyres_reserved', 'fitter_assigned',
      'en_route', 'completed', 'cancelled', 'refunded', 'payment_failed'
    )
  ),
  subtotal_pence integer not null default 0 check (subtotal_pence >= 0),
  fitting_fee_pence integer not null default 0 check (fitting_fee_pence >= 0),
  callout_fee_pence integer not null default 0 check (callout_fee_pence >= 0),
  total_pence integer not null default 0 check (total_pence >= 0),
  deposit_pence integer not null default 0 check (deposit_pence >= 0),
  balance_pence integer not null default 0 check (balance_pence >= 0),
  customer_notes text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  tyre_product_id uuid references public.tyre_products(id) on delete set null,
  sku_snapshot text not null,
  brand_snapshot text not null,
  model_snapshot text not null,
  size_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_pence integer not null check (unit_price_pence >= 0),
  line_total_pence integer not null check (line_total_pence >= 0)
);

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();


-- FROZEN CANONICAL DDL: 009_payments.sql; source SHA256 4960a9c589e22fb2db7285537fe407e83813bc2778bd7cb66b735ec82f7ad69c
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  provider text not null default 'stripe',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  type text not null check (type in ('deposit', 'balance', 'refund')),
  status text not null check (status in ('pending', 'succeeded', 'failed', 'cancelled', 'refunded')),
  amount_pence integer not null check (amount_pence >= 0),
  currency text not null default 'gbp',
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);


-- FROZEN CANONICAL DDL: 010_operations.sql; source SHA256 af87f01185e0cd904e129969740c4534fe4e6602716a8879b668dc36351e5cdb
create table if not exists public.fitters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  van_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_fitter_id_fkey' and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_fitter_id_fkey
      foreign key (fitter_id) references public.fitters(id) on delete set null;
  end if;
end;
$$;

create table if not exists public.business_settings (
  id smallint primary key default 1 check (id = 1),
  deposit_mode text not null default 'fixed' check (deposit_mode in ('fixed', 'percent')),
  deposit_value integer not null default 5000 check (deposit_value >= 0),
  slot_hold_minutes integer not null default 15 check (slot_hold_minutes between 1 and 60),
  same_day_enabled boolean not null default false,
  same_day_cutoff time,
  booking_horizon_days integer not null default 60 check (booking_horizon_days > 0),
  phone text,
  email text,
  whatsapp text,
  vat_registered boolean not null default false,
  vat_number text,
  cancellation_notice_hours integer not null default 48 check (cancellation_notice_hours >= 0),
  updated_at timestamptz not null default now()
);

insert into public.business_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vrm_cache (
  id uuid primary key default gen_random_uuid(),
  lookup_hash text not null unique,
  encrypted_payload bytea not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.interest_registrations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  postcode text not null,
  source text,
  created_at timestamptz not null default now()
);

drop trigger if exists fitters_set_updated_at on public.fitters;
create trigger fitters_set_updated_at
before update on public.fitters
for each row execute function public.set_updated_at();

drop trigger if exists business_settings_set_updated_at on public.business_settings;
create trigger business_settings_set_updated_at
before update on public.business_settings
for each row execute function public.set_updated_at();


-- FROZEN CANONICAL DDL: 011_rls.sql; source SHA256 5f7bc4ca7014c061202295e50ec642f48c8b7c9aa7ebc0c08523c145bdf416b1
create or replace function public.is_active_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = check_user_id
      and active = true
      and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_active_admin(uuid) from public;
grant execute on function public.is_active_admin(uuid) to authenticated;

alter table public.admin_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.service_zones enable row level security;
alter table public.tyre_products enable row level security;
alter table public.inventory enable row level security;
alter table public.availability_rules enable row level security;
alter table public.booking_slots enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.slot_holds enable row level security;
alter table public.inventory_holds enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.fitters enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.vrm_cache enable row level security;
alter table public.interest_registrations enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Only product-safe columns are available to the anonymous catalogue.
grant select (
  id, sku, slug, brand, model, width, profile, rim, load_index, speed_rating,
  run_flat, extra_load, season, tier, wet_grip_rating,
  fuel_efficiency_rating, noise_db, image_url, active
) on public.tyre_products to anon;

grant select (id, name, postcode_prefix, callout_fee_pence, active, priority)
on public.service_zones to anon;

-- Authenticated users still need table privileges; RLS below restricts normal
-- users to their own profile and public-safe rows, while active admins may read.
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

drop policy if exists admin_profiles_self_read on public.admin_profiles;
create policy admin_profiles_self_read
on public.admin_profiles for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists admin_profiles_admin_read on public.admin_profiles;
create policy admin_profiles_admin_read
on public.admin_profiles for select to authenticated
using (public.is_active_admin((select auth.uid())));

drop policy if exists tyre_products_public_read on public.tyre_products;
create policy tyre_products_public_read
on public.tyre_products for select to anon, authenticated
using (active = true);

drop policy if exists tyre_products_admin_read on public.tyre_products;
create policy tyre_products_admin_read
on public.tyre_products for select to authenticated
using (public.is_active_admin((select auth.uid())));

drop policy if exists service_zones_public_read on public.service_zones;
create policy service_zones_public_read
on public.service_zones for select to anon, authenticated
using (active = true);

drop policy if exists service_zones_admin_read on public.service_zones;
create policy service_zones_admin_read
on public.service_zones for select to authenticated
using (public.is_active_admin((select auth.uid())));

do $$
declare
  protected_table text;
begin
  foreach protected_table in array array[
    'customers',
    'inventory',
    'availability_rules',
    'booking_slots',
    'blocked_dates',
    'slot_holds',
    'inventory_holds',
    'bookings',
    'booking_items',
    'payments',
    'webhook_events',
    'fitters',
    'business_settings',
    'audit_logs',
    'vrm_cache',
    'interest_registrations'
  ]
  loop
    execute format('drop policy if exists active_admin_read on public.%I', protected_table);
    execute format(
      'create policy active_admin_read on public.%I for select to authenticated using (public.is_active_admin((select auth.uid())))',
      protected_table
    );
  end loop;
end;
$$;


-- FROZEN CANONICAL DDL: 012_indexes.sql; source SHA256 91158fce7bebbcd9731f532f30ae54e29d3d833f53a1981ef1a67f667b096975
create index if not exists idx_admin_profiles_user_id
  on public.admin_profiles (user_id);

create index if not exists idx_customers_email
  on public.customers (lower(email));

create index if not exists idx_service_zones_prefix_priority
  on public.service_zones (postcode_prefix, priority)
  where active = true;

create index if not exists idx_tyre_products_size
  on public.tyre_products (width, profile, rim)
  where active = true;

create index if not exists idx_inventory_product
  on public.inventory (tyre_product_id);

create index if not exists idx_booking_slots_date_active
  on public.booking_slots (date, active);

create index if not exists idx_slot_holds_slot
  on public.slot_holds (slot_id);

create index if not exists idx_slot_holds_expires_at
  on public.slot_holds (expires_at);

create index if not exists idx_inventory_holds_product
  on public.inventory_holds (tyre_product_id);

create index if not exists idx_inventory_holds_expires_at
  on public.inventory_holds (expires_at);

create index if not exists idx_bookings_reference
  on public.bookings (reference);

create index if not exists idx_bookings_slot_id
  on public.bookings (slot_id);

create index if not exists idx_bookings_status
  on public.bookings (status);

create index if not exists idx_bookings_created_at
  on public.bookings (created_at desc);

create index if not exists idx_booking_items_booking_id
  on public.booking_items (booking_id);

create index if not exists idx_payments_booking_id
  on public.payments (booking_id);

create index if not exists idx_audit_logs_created_at
  on public.audit_logs (created_at desc);

create index if not exists idx_vrm_cache_lookup_expires
  on public.vrm_cache (lookup_hash, expires_at);


-- FROZEN CANONICAL DDL: 013_gate0_canonical_foundation.sql; source SHA256 298538a74e6b807bb858828148c7827aad9ca919a947709483978087653c3705
-- Forward-only reconciliation. Preserve the original 001-012 migration history.
alter table public.admin_profiles drop constraint admin_profiles_role_check;
alter table public.admin_profiles add constraint admin_profiles_role_check
  check (role in ('owner', 'admin', 'viewer'));

alter table public.tyre_products drop constraint tyre_products_tier_check;
update public.tyre_products set tier = 'standard' where tier = 'mid';
alter table public.tyre_products add constraint tyre_products_tier_check
  check (tier in ('budget', 'standard', 'premium'));

-- The historical singleton/default is not evidence of owner-approved pricing.
-- Existing values are preserved, but cannot be quoted until explicitly configured.
alter table public.business_settings alter column deposit_mode drop default;
alter table public.business_settings alter column deposit_value drop default;
alter table public.business_settings add column pricing_configured boolean not null default false;
alter table public.business_settings add column fitting_fee_pence integer
  check (fitting_fee_pence is null or fitting_fee_pence >= 0);
alter table public.business_settings add column job_duration_minutes integer
  check (job_duration_minutes is null or job_duration_minutes > 0);
alter table public.business_settings add column cancellation_policy text;
alter table public.business_settings add constraint business_settings_percent_check
  check (deposit_mode <> 'percent' or deposit_value <= 100);
alter table public.business_settings add constraint business_settings_pricing_ready_check
  check (not pricing_configured or
    (fitting_fee_pence is not null and job_duration_minutes is not null
     and nullif(btrim(cancellation_policy), '') is not null));

-- A receipt timestamp must be supplied by a future verified payment workflow.
alter table public.payments add column succeeded_at timestamptz;

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null unique,
  hits integer not null check (hits >= 0),
  window_start timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > window_start)
);
create index idx_rate_limits_expires_at on public.rate_limits (expires_at);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete restrict,
  deduplication_key text not null unique,
  recipient text not null check (length(btrim(recipient)) > 0),
  template text not null check (length(btrim(template)) > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  provider_message_id text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'sent' or (sent_at is not null and provider_message_id is not null))
);
create index idx_email_outbox_dispatch on public.email_outbox (status, available_at);
create index idx_email_outbox_booking on public.email_outbox (booking_id);
create trigger email_outbox_set_updated_at before update on public.email_outbox
  for each row execute function public.set_updated_at();

-- No customer accounts, business seeds, booking engine or payment transitions.


-- FROZEN CANONICAL DDL: 014_gate0_access_boundary.sql; source SHA256 aecf05c8f213a09860179fef4a652f0d42c3b6489b2395b24a4f62d3aeb868fc
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


-- FROZEN CANONICAL DDL: 015_gate1_owner_business_data.sql; source SHA256 30e738d08316568c511d2fc74294d92fc0c150454e1a4dbc40e74edce4f0b58a
-- No seed records. Only an authenticated owner can supply business data via
-- the protected server route; browser roles cannot execute this function.
create function public.owner_import_business_data(
  p_actor_user_id uuid, p_session_id uuid, p_kind text, p_rows jsonb
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  actor public.admin_profiles;
  row_data jsonb;
  product public.tyre_products;
  zone public.service_zones;
  stock public.inventory;
  supplied_stock public.inventory;
  total integer := 0;
begin
  -- Serialize imports; coordinate owner demotion with Gate 0 owner changes.
  perform pg_catalog.pg_advisory_xact_lock(70824001);
  select * into actor from public.admin_profiles where user_id = p_actor_user_id for share;
  if not found or not actor.active or actor.role <> 'owner' or not exists (
    select 1 from auth.sessions where id = p_session_id and user_id = p_actor_user_id
  ) then raise insufficient_privilege using message = 'Owner access required'; end if;
  if p_kind is null or p_kind not in ('zones','catalogue')
    or p_rows is null or jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) not between 1 and 500 then
    raise invalid_parameter_value using message = 'Invalid owner batch';
  end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(row_data) <> 'object' then raise check_violation using message = 'Invalid owner row'; end if;
    if p_kind = 'zones' then
      zone := jsonb_populate_record(null::public.service_zones, row_data);
      if zone.postcode_prefix is null or zone.postcode_prefix !~ '^(?:[A-Z]{1,2}[0-9][A-Z0-9]?|GIR)$'
        or zone.name is null or btrim(zone.name) = '' or zone.priority is null or zone.priority < 0
        or zone.callout_fee_pence is null or zone.active is null then
        raise check_violation using message = 'Invalid service zone';
      end if;
      insert into public.service_zones(postcode_prefix,name,callout_fee_pence,priority,active)
      values(zone.postcode_prefix,zone.name,zone.callout_fee_pence,zone.priority,zone.active)
      on conflict (postcode_prefix) do update set name=excluded.name,callout_fee_pence=excluded.callout_fee_pence,
        priority=excluded.priority,active=excluded.active returning * into zone;
      insert into public.audit_logs(admin_user_id,action,resource_type,resource_id,metadata)
      values(p_actor_user_id,'owner.zone_imported','service_zones',zone.id,
        jsonb_build_object('postcode_prefix',zone.postcode_prefix,'active',zone.active));
    else
      product := jsonb_populate_record(null::public.tyre_products, row_data);
      supplied_stock := jsonb_populate_record(null::public.inventory, row_data->'inventory');
      if product.sku is null or btrim(product.sku) = '' or product.brand is null or btrim(product.brand) = ''
        or product.model is null or btrim(product.model) = ''
        or product.width is null or product.width not between 115 and 355
        or product.profile is null or product.profile not between 20 and 85
        or product.rim is null or product.rim not between 12 and 24
        or product.run_flat is null or product.extra_load is null or product.active is null
        or (product.image_url is not null and product.image_url !~ '^https://')
        or supplied_stock.stock_qty is null or supplied_stock.reserved_qty is null
        or supplied_stock.cost_price_pence is null or supplied_stock.selling_price_pence is null
        or supplied_stock.selling_price_pence <= 0 or supplied_stock.low_stock_threshold is null then
        raise check_violation using message = 'Invalid catalogue row';
      end if;
      insert into public.tyre_products(sku,slug,brand,model,width,profile,rim,load_index,speed_rating,
        run_flat,extra_load,season,tier,wet_grip_rating,fuel_efficiency_rating,noise_db,image_url,active)
      values(product.sku,'sku-'||encode(convert_to(product.sku,'UTF8'),'hex'),product.brand,product.model,
        product.width,product.profile,product.rim,product.load_index,product.speed_rating,product.run_flat,
        product.extra_load,product.season,product.tier,product.wet_grip_rating,product.fuel_efficiency_rating,
        product.noise_db,product.image_url,product.active)
      on conflict(sku) do update set brand=excluded.brand,model=excluded.model,width=excluded.width,
        profile=excluded.profile,rim=excluded.rim,load_index=excluded.load_index,speed_rating=excluded.speed_rating,
        run_flat=excluded.run_flat,extra_load=excluded.extra_load,season=excluded.season,tier=excluded.tier,
        wet_grip_rating=excluded.wet_grip_rating,fuel_efficiency_rating=excluded.fuel_efficiency_rating,
        noise_db=excluded.noise_db,image_url=excluded.image_url,active=excluded.active returning * into product;
      select * into stock from public.inventory where tyre_product_id=product.id for update;
      -- Reserved units are maintained by the booking engine, never overwritten
      -- by imports. Require an exact current value to reject stale stock files.
      if (found and stock.reserved_qty <> supplied_stock.reserved_qty)
        or (not found and supplied_stock.reserved_qty <> 0) then
        raise check_violation using message = 'Reserved stock changed or was invented';
      end if;
      insert into public.inventory(tyre_product_id,stock_qty,reserved_qty,cost_price_pence,selling_price_pence,
        supplier_sku,low_stock_threshold)
      values(product.id,supplied_stock.stock_qty,0,supplied_stock.cost_price_pence,supplied_stock.selling_price_pence,
        supplied_stock.supplier_sku,supplied_stock.low_stock_threshold)
      on conflict(tyre_product_id) do update set stock_qty=excluded.stock_qty,
        cost_price_pence=excluded.cost_price_pence,selling_price_pence=excluded.selling_price_pence,
        supplier_sku=excluded.supplier_sku,low_stock_threshold=excluded.low_stock_threshold;
      insert into public.audit_logs(admin_user_id,action,resource_type,resource_id,metadata)
      values(p_actor_user_id,'owner.catalogue_imported','tyre_products',product.id,
        jsonb_build_object('sku',product.sku,'active',product.active,'stock_qty',supplied_stock.stock_qty));
    end if;
    total := total + 1;
  end loop;
  return total;
end;
$$;
revoke all on function public.owner_import_business_data(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.owner_import_business_data(uuid,uuid,text,jsonb) to service_role;


-- FROZEN CANONICAL DDL: 016_gate2_atomic_booking.sql; source SHA256 5bb212a75a022ba6d65565438c1502dab316da5a046045a9356c300494317fef
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


-- FROZEN CANONICAL DDL: 017_gate3_manual_bank_payments.sql; source SHA256 dc5995dfe10ab9b7582f843e3d68b0cad45deb687144fd39e41a39705aeceedb
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


-- FROZEN CANONICAL DDL: 018_gate4_admin_operating_system.sql; source SHA256 bb2e73a952a753b2187b986634e7f16739770162aac8f15a91157326612e63ad
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
    select to_jsonb(s) into before_row from public.business_settings s where id=1 for update;
    update public.business_settings set phone=nullif(btrim(p_payload->>'phone'),''),email=nullif(btrim(p_payload->>'email'),''),
      whatsapp=nullif(btrim(p_payload->>'whatsapp'),''),fitting_fee_pence=(p_payload->>'fitting_fee_pence')::int,
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

-- Explicit data mapping: all values below originate in the locked archive.
INSERT INTO public.admin_profiles(id,user_id,name,role,active,created_at,updated_at)
SELECT id,user_id,name,role,active,created_at,updated_at FROM legacy_source_20261013.admin_profiles;
INSERT INTO public.customers(id,first_name,last_name,email,phone,created_at,updated_at)
SELECT id,coalesce(name,''),'',email,coalesce(phone,''),created_at,created_at FROM legacy_source_20261013.customers;
INSERT INTO public.service_zones(id,name,postcode_prefix,callout_fee_pence,active,priority,created_at)
SELECT id,zone_name,postcode_prefix,callout_charge,active,100,created_at FROM legacy_source_20261013.service_zones;
INSERT INTO public.fitters(id,name,phone,active,created_at,updated_at)
SELECT id,name,phone,active,created_at,created_at FROM legacy_source_20261013.fitters;
INSERT INTO public.tyre_products(id,sku,slug,brand,model,width,profile,rim,load_index,speed_rating,
  run_flat,extra_load,season,tier,wet_grip_rating,fuel_efficiency_rating,noise_db,active,created_at,updated_at)
SELECT id,sku,'sku-'||encode(convert_to(sku,'UTF8'),'hex'),brand,model,width,profile,rim,load_index,speed_rating,
  is_run_flat,is_xl,season,CASE tier WHEN 'mid' THEN 'standard' ELSE tier END,
  wet_grip,fuel_economy,noise_db,active,created_at,created_at FROM legacy_source_20261013.tyre_inventory;
-- Legacy confirmed payments already decremented stock. There is no source
-- reserved counter or product-level hold to project safely. Never double-count
-- those units; retain exact on-hand stock and freeze legacy booking mutations.
INSERT INTO public.inventory(id,tyre_product_id,stock_qty,reserved_qty,cost_price_pence,selling_price_pence,updated_at)
SELECT id,id,stock,0,cost_price,sell_price,created_at FROM legacy_source_20261013.tyre_inventory;
INSERT INTO public.booking_slots(id,date,start_at,end_at,capacity,active,created_at)
SELECT id,slot_date,start_time,end_time,max_bookings,active,created_at FROM legacy_source_20261013.booking_slots;
INSERT INTO public.bookings(id,reference,manage_token,customer_id,slot_id,fitter_id,
  registration,vehicle_make,vehicle_model,vehicle_derivative,fitting_address,postcode,
  customer_notes,admin_notes,status,subtotal_pence,fitting_fee_pence,callout_fee_pence,
  total_pence,deposit_pence,balance_pence,created_at,updated_at)
SELECT id,booking_ref,manage_token,customer_id,slot_id,fitter_id,
  vehicle_reg,vehicle_make,vehicle_model,vehicle_derivative,coalesce(fitting_address,''),coalesce(fitting_postcode,''),
  customer_notes,admin_notes,status,tyres_total,fitting_fee,callout_charge,total_amount,
  deposit_amount,balance_due,created_at,updated_at FROM legacy_source_20261013.bookings;
-- Only tyre_label is a historical product snapshot. Keep it verbatim rather
-- than inventing historical brand/model/size from today's mutable catalogue.
INSERT INTO public.booking_items(id,booking_id,tyre_product_id,sku_snapshot,brand_snapshot,model_snapshot,
  size_snapshot,quantity,unit_price_pence,line_total_pence)
SELECT i.id,i.booking_id,i.tyre_id,coalesce(t.sku,''),'',i.tyre_label,'',i.quantity,i.unit_price,i.line_total
FROM legacy_source_20261013.booking_items i LEFT JOIN legacy_source_20261013.tyre_inventory t ON t.id=i.tyre_id;
-- Duplicate session tokens were legal before. Preserve each hold and its ID;
-- only collisions receive a deterministic identity-based token. Stop if even
-- that token collides (the canonical unique constraint aborts the transaction).
INSERT INTO public.slot_holds(id,slot_id,token,expires_at,created_at)
SELECT id,slot_id,CASE WHEN count(*) OVER(PARTITION BY session_token)=1 THEN session_token
  ELSE 'legacy-hold:'||id::text END,expires_at,created_at FROM legacy_source_20261013.slot_holds;
INSERT INTO public.interest_registrations(id,email,postcode,source,created_at)
SELECT id,email,postcode,source,created_at FROM legacy_source_20261013.interest_registrations;
-- Legacy throttles retained every request window, with a one-hour cleanup.
-- Consolidation is conservative; every original counter remains in both archives.
INSERT INTO public.rate_limits(id,bucket_key,hits,window_start,expires_at)
SELECT (array_agg(id ORDER BY window_start DESC,id))[1],bucket_key,sum(hits)::integer,
  max(window_start),max(window_start)+interval '1 hour' FROM legacy_source_20261013.rate_limits GROUP BY bucket_key;
UPDATE public.business_settings s SET
  deposit_mode=a.deposit_mode,
  deposit_value=CASE a.deposit_mode WHEN 'fixed' THEN a.deposit_fixed ELSE a.deposit_percent END,
  fitting_fee_pence=a.fitting_fee,job_duration_minutes=a.job_duration_mins,
  phone=a.business_phone,cancellation_policy=a.cancellation_policy,
  pricing_configured=false,bank_account_name=NULL,bank_name=NULL,sort_code=NULL,account_number=NULL,
  bank_payment_window_minutes=NULL,updated_at=a.updated_at
FROM legacy_source_20261013.app_settings a WHERE s.id=1 AND a.id=1;
INSERT INTO public.audit_logs(id,admin_user_id,action,resource_type,resource_id,metadata,created_at,after_state)
SELECT a.id,u.id,a.action,coalesce(a.entity,'legacy_unspecified'),a.entity_id,
  jsonb_build_object('legacy_actor',a.actor,'legacy_metadata',a.metadata,'legacy_entity',a.entity),a.created_at,
  jsonb_build_object('legacy_import',true)
FROM legacy_source_20261013.audit_log a LEFT JOIN auth.users u ON u.id::text=lower(a.actor);
-- No Stripe/bank receipts, refund records or customer emails are manufactured.
-- Plaintext VRM cache remains solely in the private archives. The encrypted
-- canonical cache starts cold; encryption needs the application's real key.

-- The legacy pending state used to consume a slot without a bank deadline.
-- Preserve the booking and old holds, and close that slot to NEW checkout until
-- a human resolves the pending legacy booking. Do not invent a payment window.
UPDATE public.booking_slots s SET blocked_reason='Legacy pending booking requires owner review'
WHERE EXISTS(SELECT 1 FROM legacy_source_20261013.bookings b WHERE b.slot_id=s.id AND b.status='pending_payment');

-- Additional reconciliation guard, separate from unchanged Gate 1-4 RPCs.
-- New bookings remain fully operable. Existing bookings cannot accidentally
-- release stock twice, forge bank receipts or rewrite historical amounts.
CREATE FUNCTION legacy_backup_20261013.guard_legacy_booking() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $legacy_guard$
BEGIN
  IF EXISTS(SELECT 1 FROM legacy_backup_20261013.bookings WHERE id=old.id) THEN
    RAISE EXCEPTION USING errcode='55000',message='Legacy booking is read-only pending a reviewed operational reconciliation';
  END IF;
  IF TG_OP='DELETE' THEN RETURN old; END IF;
  RETURN new;
END;
$legacy_guard$;
REVOKE ALL ON FUNCTION legacy_backup_20261013.guard_legacy_booking() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER bookings_legacy_preservation BEFORE UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION legacy_backup_20261013.guard_legacy_booking();
NOTIFY pgrst,'reload schema';

do $verify$
declare
  required_tables constant text[] := array[
    'admin_profiles', 'customers', 'service_zones', 'tyre_products', 'inventory',
    'availability_rules', 'booking_slots', 'blocked_dates', 'slot_holds',
    'inventory_holds', 'bookings', 'booking_items', 'payments', 'webhook_events',
    'fitters', 'business_settings', 'audit_logs', 'vrm_cache',
    'interest_registrations', 'rate_limits', 'email_outbox', 'special_dates'
  ];
  protected_tables constant text[] := array[
    'customers', 'inventory', 'availability_rules', 'booking_slots',
    'blocked_dates', 'slot_holds', 'inventory_holds', 'bookings',
    'booking_items', 'payments', 'webhook_events', 'fitters',
    'business_settings', 'audit_logs', 'vrm_cache', 'interest_registrations', 'rate_limits', 'email_outbox', 'special_dates'
  ];
  missing text;
  table_name text;
  column_name text;
  expected_anon_select boolean;
  actual_count integer;
begin
  select string_agg(name, ', ' order by name)
  into missing
  from unnest(required_tables) as name
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = name
      and c.relkind = 'r'
  );

  if missing is not null then
    raise exception 'Missing required ordinary tables: %', missing;
  end if;

  select string_agg(name, ', ' order by name)
  into missing
  from unnest(required_tables) as name
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = name
      and c.relkind = 'r'
      and c.relrowsecurity
  );

  if missing is not null then
    raise exception 'RLS is not enabled on: %', missing;
  end if;

  -- Every V3 table must have exactly the expected single-column id PK.
  select string_agg(name, ', ' order by name)
  into missing
  from unnest(required_tables) as name
  where not exists (
    select 1
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public'
      and r.relname = name
      and c.contype = 'p'
      and c.convalidated
      and (
        select array_agg(a.attname order by key.ordinality)
        from unnest(c.conkey) with ordinality as key(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = key.attnum
      ) = array['id']::name[]
  );

  if missing is not null then
    raise exception 'Missing, invalid, or incorrectly shaped primary keys: %', missing;
  end if;

  -- Exact unique-column shapes, rather than name/substring matching.
  select string_agg(format('%s(%s)', expected.table_name, array_to_string(expected.columns, ',')), ', ')
  into missing
  from (values
    ('admin_profiles', array['user_id']::name[]),
    ('service_zones', array['postcode_prefix']::name[]),
    ('tyre_products', array['sku']::name[]),
    ('tyre_products', array['slug']::name[]),
    ('inventory', array['tyre_product_id']::name[]),
    ('booking_slots', array['date', 'start_at', 'end_at']::name[]),
    ('blocked_dates', array['date']::name[]),
    ('slot_holds', array['token']::name[]),
    ('slot_holds', array['booking_id']::name[]),
    ('bookings', array['checkout_key']::name[]),
    ('inventory_holds', array['slot_hold_id', 'tyre_product_id']::name[]),
    ('bookings', array['reference']::name[]),
    ('bookings', array['manage_token']::name[]),
    ('payments', array['stripe_checkout_session_id']::name[]),
    ('payments', array['stripe_payment_intent_id']::name[]),
    ('webhook_events', array['provider', 'event_id']::name[]),
    ('vrm_cache', array['lookup_hash']::name[]),
    ('rate_limits', array['bucket_key']::name[]),
    ('email_outbox', array['deduplication_key']::name[]),
    ('special_dates', array['date']::name[])
  ) as expected(table_name, columns)
  where not exists (
    select 1
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public'
      and r.relname = expected.table_name
      and c.contype = 'u'
      and c.convalidated
      and (
        select array_agg(a.attname order by key.ordinality)
        from unnest(c.conkey) with ordinality as key(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = key.attnum
      ) = expected.columns
  );

  if missing is not null then
    raise exception 'Missing or incorrectly shaped unique constraints: %', missing;
  end if;

  select count(*)::integer into actual_count
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  join pg_namespace n on n.oid = r.relnamespace
  where n.nspname = 'public'
    and r.relname = any(required_tables)
    and c.contype = 'u';

  if actual_count <> 20 then
    raise exception 'Expected exactly 20 canonical unique constraints, found %', actual_count;
  end if;

  -- pg_get_expr canonicalizes IN clauses to = ANY(ARRAY[...]). The expression
  -- normalizer removes whitespace, parentheses and simple type casts only;
  -- equality below still rejects extra OR branches, extra accepted enum values,
  -- or weaker numeric bounds.
  select string_agg(format('%s [%s]', expected.table_name, expected.expression), ', ')
  into missing
  from (values
    ('admin_profiles', 'role=anyarray[''owner'',''admin'',''viewer'']'),
    ('service_zones', 'callout_fee_pence>=0'),
    ('tyre_products', 'width>0'),
    ('tyre_products', 'profile>0'),
    ('tyre_products', 'rim>0'),
    ('tyre_products', 'season=anyarray[''summer'',''all-season'',''winter'']'),
    ('tyre_products', 'tier=anyarray[''budget'',''standard'',''premium'']'),
    ('tyre_products', 'noise_dbisnullornoise_db>=0'),
    ('inventory', 'stock_qty>=0'),
    ('inventory', 'reserved_qty>=0andreserved_qty<=stock_qty'),
    ('inventory', 'cost_price_pence>=0'),
    ('inventory', 'selling_price_pence>=0'),
    ('inventory', 'low_stock_threshold>=0'),
    ('availability_rules', 'day_of_week>=0andday_of_week<=6'),
    ('availability_rules', 'slot_duration_minutes>0'),
    ('availability_rules', 'capacity>0'),
    ('availability_rules', 'end_time>start_time'),
    ('booking_slots', 'capacity>0'),
    ('booking_slots', 'end_at>start_at'),
    ('inventory_holds', 'quantity>0'),
    ('bookings', 'status=anyarray[''pending_payment'',''confirmed'',''tyres_reserved'',''fitter_assigned'',''en_route'',''completed'',''cancelled'',''refunded'',''payment_failed'',''awaiting_bank_payment'',''expired'',''confirmed'']'),
    ('bookings', 'subtotal_pence>=0'),
    ('bookings', 'fitting_fee_pence>=0'),
    ('bookings', 'callout_fee_pence>=0'),
    ('bookings', 'total_pence>=0'),
    ('bookings', 'deposit_pence>=0'),
    ('bookings', 'balance_pence>=0'),
    ('booking_items', 'quantity>0'),
    ('booking_items', 'unit_price_pence>=0'),
    ('booking_items', 'line_total_pence>=0'),
    ('payments', 'type=anyarray[''deposit'',''balance'',''refund'']'),
    ('payments', 'status=anyarray[''pending'',''succeeded'',''failed'',''cancelled'',''refunded'',''received'']'),
    ('payments', 'amount_pence>=0'),
    ('business_settings', 'bank_account_nameisnullorlengthbtrimbank_account_name>=1andlengthbtrimbank_account_name<=120'),
    ('business_settings', 'bank_nameisnullorlengthbtrimbank_name>=1andlengthbtrimbank_name<=120'),
    ('business_settings', 'sort_codeisnullorsort_code~''^[0-9]{6}$'''),
    ('business_settings', 'account_numberisnulloraccount_number~''^[0-9]{8}$'''),
    ('bookings', 'booking_source=anyarray[''online'',''phone'']'),
    ('business_settings', 'bank_payment_window_minutes>=1andbank_payment_window_minutes<=10080'),
    ('bookings', 'status<>''awaiting_bank_payment''orcheckout_keyisnotnull'),
    ('bookings', 'checkout_keyisnullandcheckout_fingerprintisnullandbank_payment_expires_atisnullorcheckout_keyisnotnullandcheckout_fingerprintisnotnullandbank_payment_expires_atisnotnullandsubtotal_pence+fitting_fee_pence+callout_fee_pence=total_penceanddeposit_pence+balance_pence=total_pence'),
    ('business_settings', 'id=1'),
    ('business_settings', 'deposit_mode=anyarray[''fixed'',''percent'']'),
    ('business_settings', 'deposit_value>=0'),
    ('business_settings', 'slot_hold_minutes>=1andslot_hold_minutes<=60'),
    ('business_settings', 'booking_horizon_days>0'),
    ('business_settings', 'cancellation_notice_hours>=0')
  ) as expected(table_name, expression)
  where not exists (
    select 1
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public'
      and r.relname = expected.table_name
      and c.contype = 'c'
      and c.convalidated
      and regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(pg_get_expr(c.conbin, c.conrelid, true)),
            '::[a-z_][a-z0-9_]*(\[\])?', '', 'g'
          ),
          '[[:space:]]+', '', 'g'
        ),
        '[()]', '', 'g'
      ) = expected.expression
  );

  if missing is not null then
    raise exception 'Missing or weakened check-constraint semantics: %', missing;
  end if;

  select count(*)::integer into actual_count
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  join pg_namespace n on n.oid = r.relnamespace
  where n.nspname = 'public'
    and r.relname = any(required_tables)
    and c.contype = 'c';

  if actual_count <> 66 then
    raise exception 'Expected exactly 66 canonical check constraints, found %', actual_count;
  end if;

  -- Exact source/target columns and ON DELETE actions for all 14 FKs.
  select string_agg(
    format('%s(%s) -> %s.%s(%s)', expected.source_table,
      array_to_string(expected.source_columns, ','), expected.target_schema,
      expected.target_table, array_to_string(expected.target_columns, ',')), ', '
  )
  into missing
  from (values
    ('admin_profiles', array['user_id']::name[], 'auth', 'users', array['id']::name[], 'c'),
    ('inventory', array['tyre_product_id']::name[], 'public', 'tyre_products', array['id']::name[], 'c'),
    ('blocked_dates', array['created_by']::name[], 'auth', 'users', array['id']::name[], 'n'),
    ('slot_holds', array['booking_id']::name[], 'public', 'bookings', array['id']::name[], 'r'),
    ('slot_holds', array['slot_id']::name[], 'public', 'booking_slots', array['id']::name[], 'c'),
    ('inventory_holds', array['slot_hold_id']::name[], 'public', 'slot_holds', array['id']::name[], 'c'),
    ('inventory_holds', array['tyre_product_id']::name[], 'public', 'tyre_products', array['id']::name[], 'c'),
    ('bookings', array['customer_id']::name[], 'public', 'customers', array['id']::name[], 'n'),
    ('bookings', array['slot_id']::name[], 'public', 'booking_slots', array['id']::name[], 'r'),
    ('bookings', array['fitter_id']::name[], 'public', 'fitters', array['id']::name[], 'n'),
    ('bookings', array['service_zone_id']::name[], 'public', 'service_zones', array['id']::name[], 'n'),
    ('booking_items', array['booking_id']::name[], 'public', 'bookings', array['id']::name[], 'c'),
    ('booking_items', array['tyre_product_id']::name[], 'public', 'tyre_products', array['id']::name[], 'n'),
    ('payments', array['verified_by_admin_id']::name[], 'public', 'admin_profiles', array['id']::name[], 'r'),
    ('payments', array['refunded_by_admin_id']::name[], 'public', 'admin_profiles', array['id']::name[], 'r'),
    ('payments', array['booking_id']::name[], 'public', 'bookings', array['id']::name[], 'r'),
    ('audit_logs', array['admin_user_id']::name[], 'auth', 'users', array['id']::name[], 'n'),
    ('email_outbox', array['booking_id']::name[], 'public', 'bookings', array['id']::name[], 'r')
  ) as expected(
    source_table, source_columns, target_schema, target_table, target_columns, delete_action
  )
  where not exists (
    select 1
    from pg_constraint c
    join pg_class source on source.oid = c.conrelid
    join pg_namespace source_ns on source_ns.oid = source.relnamespace
    join pg_class target on target.oid = c.confrelid
    join pg_namespace target_ns on target_ns.oid = target.relnamespace
    where source_ns.nspname = 'public'
      and source.relname = expected.source_table
      and target_ns.nspname = expected.target_schema
      and target.relname = expected.target_table
      and c.contype = 'f'
      and c.convalidated
      and c.confdeltype::text = expected.delete_action
      and (
        select array_agg(a.attname order by key.ordinality)
        from unnest(c.conkey) with ordinality as key(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = key.attnum
      ) = expected.source_columns
      and (
        select array_agg(a.attname order by key.ordinality)
        from unnest(c.confkey) with ordinality as key(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.confrelid and a.attnum = key.attnum
      ) = expected.target_columns
  );

  if missing is not null then
    raise exception 'Missing or incorrectly defined foreign keys: %', missing;
  end if;

  select count(*)::integer into actual_count
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  join pg_namespace n on n.oid = r.relnamespace
  where n.nspname = 'public'
    and r.relname = any(required_tables)
    and c.contype = 'f';

  if actual_count <> 18 then
    raise exception 'Expected exactly 18 canonical foreign keys, found %', actual_count;
  end if;

  -- The expected relation must be a valid, ready index on the expected table.
  select string_agg(expected.index_name, ', ' order by expected.index_name)
  into missing
  from (values
    ('idx_admin_profiles_user_id', 'admin_profiles'),
    ('idx_customers_email', 'customers'),
    ('idx_service_zones_prefix_priority', 'service_zones'),
    ('idx_tyre_products_size', 'tyre_products'),
    ('idx_inventory_product', 'inventory'),
    ('idx_booking_slots_date_active', 'booking_slots'),
    ('idx_slot_holds_slot', 'slot_holds'),
    ('idx_slot_holds_expires_at', 'slot_holds'),
    ('idx_inventory_holds_product', 'inventory_holds'),
    ('idx_inventory_holds_expires_at', 'inventory_holds'),
    ('idx_bookings_reference', 'bookings'),
    ('idx_bookings_slot_id', 'bookings'),
    ('idx_bookings_status', 'bookings'),
    ('idx_bookings_created_at', 'bookings'),
    ('idx_booking_items_booking_id', 'booking_items'),
    ('idx_payments_booking_id', 'payments'),
    ('idx_payments_manual_booking', 'payments'),
    ('idx_audit_logs_created_at', 'audit_logs'),
    ('idx_vrm_cache_lookup_expires', 'vrm_cache'),
    ('idx_rate_limits_expires_at', 'rate_limits'),
    ('idx_email_outbox_dispatch', 'email_outbox'),
    ('idx_email_outbox_booking', 'email_outbox'),
    ('idx_bookings_bank_expiry', 'bookings'),
    ('idx_inventory_holds_live_product', 'inventory_holds'),
    ('idx_special_dates_date_active', 'special_dates')
  ) as expected(index_name, table_name)
  where not exists (
    select 1
    from pg_class index_relation
    join pg_namespace index_ns on index_ns.oid = index_relation.relnamespace
    join pg_index index_state on index_state.indexrelid = index_relation.oid
    join pg_class target on target.oid = index_state.indrelid
    join pg_namespace target_ns on target_ns.oid = target.relnamespace
    where index_ns.nspname = 'public'
      and index_relation.relname = expected.index_name
      and index_relation.relkind = 'i'
      and target_ns.nspname = 'public'
      and target.relname = expected.table_name
      and index_state.indisvalid
      and index_state.indisready
  );

  if missing is not null then
    raise exception 'Missing, invalid, or mis-targeted required indexes: %', missing;
  end if;

  -- Validate each policy's exact role set, command, permissiveness, USING
  -- expression and absence of WITH CHECK. Exact total count rejects extras.
  select string_agg(format('%s.%s', expected.table_name, expected.policy_name), ', ')
  into missing
  from (
    select * from (values
      ('admin_profiles', 'admin_profiles_self_read', array['authenticated']::text[], 'user_id=selectauth.uidandhas_live_session'),
      ('admin_profiles', 'admin_profiles_admin_read', array['authenticated']::text[], 'is_active_adminselectauth.uid'),
      ('tyre_products', 'tyre_products_public_read', array['anon', 'authenticated']::text[], 'active=true'),
      ('tyre_products', 'tyre_products_admin_read', array['authenticated']::text[], 'is_active_adminselectauth.uid'),
      ('service_zones', 'service_zones_public_read', array['anon', 'authenticated']::text[], 'active=true'),
      ('service_zones', 'service_zones_admin_read', array['authenticated']::text[], 'is_active_adminselectauth.uid')
    ) as named(table_name, policy_name, roles, normalized_qual)
    union all
    select name, 'active_admin_read', array['authenticated']::text[],
           'is_active_adminselectauth.uid'
    from unnest(protected_tables) as name
  ) as expected(table_name, policy_name, roles, normalized_qual)
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = expected.table_name
      and p.policyname = expected.policy_name
      and p.permissive = 'PERMISSIVE'
      and p.cmd = 'SELECT'
      and (
        select array_agg(role_name::text order by role_name::text)
        from unnest(p.roles) as role_name
      ) = expected.roles
      and regexp_replace(
        replace(
          replace(
            regexp_replace(lower(coalesce(p.qual, '')), '[[:space:]]+', '', 'g'),
            'asuid', ''
          ),
          'public.', ''
        ),
        '[()]', '', 'g'
      ) = expected.normalized_qual
      and p.with_check is null
  );

  if missing is not null then
    raise exception 'Missing or incorrectly defined RLS policies: %', missing;
  end if;

  select count(*)::integer into actual_count
  from pg_policies
  where schemaname = 'public';

  if actual_count <> 25 then
    raise exception 'Expected exactly 25 public RLS policies, found %', actual_count;
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_active_admin'
      and p.pronargs = 1
      and p.proargtypes[0] = 'uuid'::regtype
      and p.prorettype = 'boolean'::regtype
      and p.provolatile = 's'
      and p.prosecdef
      and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
  ) then
    raise exception 'public.is_active_admin(uuid) has the wrong signature, volatility, or security/search_path configuration';
  end if;

  if not has_function_privilege('authenticated', 'public.is_active_admin(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.is_active_admin(uuid)', 'EXECUTE') then
    raise exception 'public.is_active_admin(uuid) EXECUTE grants are incorrect';
  end if;

  -- Test effective privileges for the actual roles, including grants inherited
  -- from PUBLIC or membership in another role. This checks every live column,
  -- not only direct rows from information_schema.column_privileges.
  for table_name, column_name in
    select r.relname, a.attname
    from pg_class r
    join pg_namespace n on n.oid = r.relnamespace
    join pg_attribute a on a.attrelid = r.oid
    where n.nspname = 'public'
      and r.relkind = 'r'
      and r.relname = any(required_tables)
      and a.attnum > 0
      and not a.attisdropped
    order by r.relname, a.attnum
  loop
    expected_anon_select :=
      (table_name = 'tyre_products' and column_name = any(array[
        'active', 'brand', 'extra_load', 'fuel_efficiency_rating', 'id', 'image_url',
        'load_index', 'model', 'noise_db', 'profile', 'rim', 'run_flat', 'season',
        'sku', 'slug', 'speed_rating', 'tier', 'wet_grip_rating', 'width'
      ]))
      or
      (table_name = 'service_zones' and column_name = any(array[
        'active', 'callout_fee_pence', 'id', 'name', 'postcode_prefix', 'priority'
      ]));

    if has_column_privilege(
      'anon', format('public.%I', table_name), column_name, 'SELECT'
    ) is distinct from expected_anon_select then
      raise exception 'anon effective SELECT privilege is incorrect on public.%.%',
        table_name, column_name;
    end if;

    if has_column_privilege('anon', format('public.%I', table_name), column_name, 'INSERT')
       or has_column_privilege('anon', format('public.%I', table_name), column_name, 'UPDATE')
       or has_column_privilege('anon', format('public.%I', table_name), column_name, 'REFERENCES')
       or has_column_privilege('authenticated', format('public.%I', table_name), column_name, 'INSERT')
       or has_column_privilege('authenticated', format('public.%I', table_name), column_name, 'UPDATE')
       or has_column_privilege('authenticated', format('public.%I', table_name), column_name, 'REFERENCES') then
      raise exception 'anon/authenticated has an effective column mutation privilege on public.%.%',
        table_name, column_name;
    end if;
  end loop;

  select count(*)::integer into actual_count
  from pg_class r
  join pg_namespace n on n.oid = r.relnamespace
  join pg_attribute a on a.attrelid = r.oid
  where n.nspname = 'public'
    and r.relkind = 'r'
    and r.relname = any(required_tables)
    and a.attnum > 0
    and not a.attisdropped
    and has_column_privilege('anon', format('public.%I', r.relname), a.attname, 'SELECT');

  if actual_count <> 25 then
    raise exception 'Expected exactly 25 effective anonymous SELECT columns, found %', actual_count;
  end if;

  foreach table_name in array required_tables loop
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
       or has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
       or has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
       or has_table_privilege('anon', format('public.%I', table_name), 'TRUNCATE') then
      raise exception 'anon unexpectedly has a table-level privilege on public.%', table_name;
    end if;

    if not has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'TRUNCATE') then
      raise exception 'authenticated table privileges are incorrect on public.%', table_name;
    end if;
  end loop;
  if has_schema_privilege('anon', 'public', 'CREATE')
    or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception 'Browser roles can create public schema objects';
  end if;

  foreach table_name in array array[
    'public.admin_set_inventory(uuid,uuid,uuid,integer,integer)',
    'public.owner_set_admin_access(uuid,uuid,uuid,text,boolean)',
    'public.consume_rate_limit(text,integer,integer)',
    'public.owner_import_business_data(uuid,uuid,text,jsonb)',
    'public.reserve_booking_checkout(uuid,uuid,jsonb,jsonb,text,jsonb,text)',
    'public.expire_unpaid_bookings()', 'public.live_inventory_held(uuid)', 'public.slot_consumption(uuid)',
    'public.owner_set_bank_settings(uuid,uuid,text,text,text,text,integer)',
    'public.admin_verify_bank_payment(uuid,uuid,uuid,integer)',
    'public.admin_extend_bank_window(uuid,uuid,uuid,integer,text,timestamptz)',
    'public.admin_reserve_phone_booking(uuid,uuid,uuid,uuid,jsonb,jsonb,text,jsonb,text)',
    'public.admin_claim_bank_email(uuid,uuid,uuid)', 'public.finish_bank_email(uuid,integer,text)',
    'public.owner_provision_admin(uuid,uuid,uuid,text,text)',
    'public.admin_os_mutate(uuid,uuid,text,jsonb)', 'public.admin_os_import_products(uuid,uuid,jsonb)'
  ] loop
    if has_function_privilege('anon', table_name, 'EXECUTE')
      or has_function_privilege('authenticated', table_name, 'EXECUTE')
      or not has_function_privilege('service_role', table_name, 'EXECUTE') then
      raise exception 'Server function grants are incorrect: %', table_name;
    end if;
  end loop;

  select string_agg(signature, ', ') into missing from unnest(array[
    'public.has_live_session()', 'public.is_active_admin(uuid)',
    'public.admin_session_context()',
    'public.admin_set_inventory(uuid,uuid,uuid,integer,integer)',
    'public.owner_set_admin_access(uuid,uuid,uuid,text,boolean)',
    'public.consume_rate_limit(text,integer,integer)',
    'public.owner_import_business_data(uuid,uuid,text,jsonb)',
    'public.owner_provision_admin(uuid,uuid,uuid,text,text)',
    'public.admin_os_mutate(uuid,uuid,text,jsonb)', 'public.admin_os_import_products(uuid,uuid,jsonb)'
  ]) signature where not exists (
    select 1 from pg_proc p where p.oid = signature::regprocedure
      and p.prosecdef and 'search_path=""' = any(p.proconfig)
  );
  if missing is not null then raise exception 'Unsafe function security/search_path: %', missing; end if;

  select string_agg(name, ', ') into missing from unnest(array[
    'admin_profiles', 'customers', 'tyre_products', 'inventory',
    'bookings', 'fitters', 'business_settings', 'email_outbox', 'payments', 'special_dates'
  ]) name where not exists (
    select 1 from pg_trigger t join pg_class r on r.oid = t.tgrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = name
      and t.tgname = name || '_set_updated_at' and not t.tgisinternal
      and t.tgtype = 19 and t.tgenabled = 'O'
      and t.tgfoid = 'public.set_updated_at()'::regprocedure
  );
  if missing is not null then raise exception 'Missing/incorrect update triggers: %', missing; end if;

  select string_agg(expected.name, ', ') into missing from (values
    ('payments_manual_immutable','payments','public.guard_manual_payment()',27),
    ('booking_items_immutable','booking_items','public.guard_booking_items()',27),
    ('bookings_bank_terms_immutable','bookings','public.guard_bank_booking()',19),
    ('inventory_live_reservations','inventory','public.guard_inventory_holds_stock()',19),
    ('booking_slots_live_reservations','booking_slots','public.guard_slot_capacity()',19),
    ('audit_logs_immutable','audit_logs','public.guard_audit_history()',27),
    ('audit_logs_complete','audit_logs','public.complete_admin_audit()',7)
  ) expected(name,table_name,fn,kind) where not exists (
    select 1 from pg_trigger t join pg_class r on r.oid=t.tgrelid join pg_namespace n on n.oid=r.relnamespace
    where n.nspname='public' and r.relname=expected.table_name and t.tgname=expected.name
      and t.tgfoid=expected.fn::regprocedure and t.tgtype=expected.kind and t.tgenabled='O' and not t.tgisinternal);
  if missing is not null then raise exception 'Missing Gate 2 guards: %',missing; end if;

  if not exists (select 1 from pg_constraint where conrelid='public.payments'::regclass
    and conname='payments_manual_check' and contype='c' and convalidated) then
    raise exception 'Manual payment integrity check missing'; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.payments'::regclass
    and conname='payments_manual_refund_details_check' and contype='c' and convalidated) then
    raise exception 'Manual refund detail integrity check missing'; end if;
  if not exists (select 1 from pg_index i where i.indexrelid='public.idx_payments_manual_booking'::regclass
    and i.indisunique and i.indisvalid and i.indisready
    and pg_get_expr(i.indpred,i.indrelid)='(provider = ''manual''::text)'
    and (select array_agg(a.attname) from unnest(i.indkey) k join pg_attribute a
      on a.attrelid=i.indrelid and a.attnum=k)=array['booking_id']::name[]) then
    raise exception 'Manual payment uniqueness predicate/columns incorrect'; end if;

  if exists (select 1 from pg_class r join pg_namespace n on n.oid=r.relnamespace
    where n.nspname='public' and r.relname in ('tyre_inventory','app_settings','audit_log')) then
    raise exception 'Conflicting legacy database objects remain';
  end if;
end;
$verify$;
DO $preservation$
DECLARE r record; n bigint; fingerprint text; missing text;
BEGIN
  -- Every original table, including unknown business tables, must have both a
  -- byte-equivalent logical copy and its original OID in the source archive.
  FOR r IN SELECT * FROM legacy_backup_20261013.reconciliation_manifest LOOP
    IF to_regclass(format('legacy_source_20261013.%I',r.table_name))::oid IS DISTINCT FROM r.source_oid THEN
      RAISE EXCEPTION 'Original table identity was not preserved: %',r.table_name; END IF;
    EXECUTE format('SELECT count(*),md5(coalesce(string_agg(h,'''' ORDER BY h),'''')) FROM (SELECT md5(to_jsonb(t)::text) h FROM legacy_source_20261013.%I t) s',r.table_name) INTO n,fingerprint;
    IF n<>r.source_count OR fingerprint IS DISTINCT FROM r.source_fingerprint THEN
      RAISE EXCEPTION 'Original archive preservation failed: %',r.table_name; END IF;
    EXECUTE format('SELECT count(*),md5(coalesce(string_agg(h,'''' ORDER BY h),'''')) FROM (SELECT md5(to_jsonb(t)::text) h FROM legacy_backup_20261013.%I t) s',r.table_name) INTO n,fingerprint;
    IF n<>r.source_count OR fingerprint IS DISTINCT FROM r.source_fingerprint THEN
      RAISE EXCEPTION 'Backup preservation failed: %',r.table_name; END IF;
  END LOOP;
  FOR r IN SELECT * FROM legacy_backup_20261013.auth_attestation LOOP
    EXECUTE format('SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY t.id),'''')) FROM auth.%I t',r.table_name) INTO n,fingerprint;
    IF n<>r.source_count OR fingerprint IS DISTINCT FROM r.source_fingerprint THEN
      RAISE EXCEPTION 'Auth identity/session preservation failed: %',r.table_name; END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('admin_profiles','admin_profiles'),('customers','customers'),('fitters','fitters'),
    ('bookings','bookings'),('booking_items','booking_items'),('service_zones','service_zones'),
    ('booking_slots','booking_slots'),('slot_holds','slot_holds'),('interest_registrations','interest_registrations'),
    ('tyre_inventory','tyre_products'),('tyre_inventory','inventory'),('audit_log','audit_logs')
  ) t(source_table,target_table) LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',r.target_table) INTO n;
    IF n IS DISTINCT FROM (SELECT source_count FROM legacy_backup_20261013.reconciliation_manifest WHERE table_name=r.source_table) THEN
      RAISE EXCEPTION 'Canonical count differs from source: %',r.target_table; END IF;
    EXECUTE format('SELECT count(*) FROM legacy_backup_20261013.%I s LEFT JOIN public.%I t ON t.id=s.id WHERE t.id IS NULL',r.source_table,r.target_table) INTO n;
    IF n<>0 THEN RAISE EXCEPTION 'Legacy IDs missing from: %',r.target_table; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM legacy_backup_20261013.admin_profiles l LEFT JOIN public.admin_profiles p ON p.id=l.id
    WHERE p.user_id IS DISTINCT FROM l.user_id OR p.role IS DISTINCT FROM l.role OR p.active IS DISTINCT FROM l.active
      OR p.name IS DISTINCT FROM l.name) OR NOT EXISTS(SELECT 1 FROM public.admin_profiles WHERE role='owner' AND active) THEN
    RAISE EXCEPTION 'Admin relationship/role/active owner was altered'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_backup_20261013.tyre_inventory l JOIN public.tyre_products p ON p.id=l.id
    JOIN public.inventory i ON i.tyre_product_id=p.id WHERE
    (p.sku,p.slug,p.brand,p.model,p.width,p.profile,p.rim,p.load_index,p.speed_rating,p.run_flat,p.extra_load,p.season,p.tier,
      p.wet_grip_rating,p.fuel_efficiency_rating,p.noise_db,p.active,i.stock_qty,i.reserved_qty,i.cost_price_pence,i.selling_price_pence)
    IS DISTINCT FROM
    (l.sku,'sku-'||encode(convert_to(l.sku,'UTF8'),'hex'),l.brand,l.model,l.width,l.profile,l.rim,l.load_index,l.speed_rating,l.is_run_flat,l.is_xl,l.season,
      CASE l.tier WHEN 'mid' THEN 'standard' ELSE l.tier END,l.wet_grip,l.fuel_economy,l.noise_db,l.active,l.stock,0,l.cost_price,l.sell_price)) THEN
    RAISE EXCEPTION 'Catalogue attributes, SKUs, prices or stock changed'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_backup_20261013.bookings l JOIN public.bookings b ON b.id=l.id WHERE
    (b.reference,b.manage_token,b.customer_id,b.slot_id,b.fitter_id,b.registration,b.vehicle_make,b.vehicle_model,b.vehicle_derivative,
      b.fitting_address,b.postcode,b.status,b.subtotal_pence,b.fitting_fee_pence,b.callout_fee_pence,b.total_pence,b.deposit_pence,b.balance_pence,
      b.customer_notes,b.admin_notes,b.created_at,b.updated_at)
    IS DISTINCT FROM
    (l.booking_ref,l.manage_token,l.customer_id,l.slot_id,l.fitter_id,l.vehicle_reg,l.vehicle_make,l.vehicle_model,l.vehicle_derivative,
      coalesce(l.fitting_address,''),coalesce(l.fitting_postcode,''),l.status,l.tyres_total,l.fitting_fee,l.callout_charge,l.total_amount,l.deposit_amount,l.balance_due,
      l.customer_notes,l.admin_notes,l.created_at,l.updated_at)) THEN
    RAISE EXCEPTION 'Historical booking fields, token, relationships, state or money changed'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_backup_20261013.booking_items l JOIN public.booking_items i ON i.id=l.id
    WHERE (i.booking_id,i.tyre_product_id,i.quantity,i.unit_price_pence,i.line_total_pence,i.model_snapshot)
      IS DISTINCT FROM (l.booking_id,l.tyre_id,l.quantity,l.unit_price,l.line_total,l.tyre_label)) THEN
    RAISE EXCEPTION 'Historical item price, label or relationship changed'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_backup_20261013.service_zones l JOIN public.service_zones z ON z.id=l.id
    WHERE (z.name,z.postcode_prefix,z.callout_fee_pence,z.active,z.priority) IS DISTINCT FROM (l.zone_name,l.postcode_prefix,l.callout_charge,l.active,100)) THEN
    RAISE EXCEPTION 'Service zone preservation failed'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_backup_20261013.booking_slots l JOIN public.booking_slots s ON s.id=l.id
    WHERE (s.date,s.start_at,s.end_at,s.capacity,s.active) IS DISTINCT FROM (l.slot_date,l.start_time,l.end_time,l.max_bookings,l.active)) THEN
    RAISE EXCEPTION 'Slot date/time/capacity preservation failed'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_backup_20261013.customers l JOIN public.customers c ON c.id=l.id
    WHERE (c.first_name,c.last_name,c.email,c.phone,c.created_at,c.updated_at)
      IS DISTINCT FROM (coalesce(l.name,''),'',l.email,coalesce(l.phone,''),l.created_at,l.created_at))
    OR EXISTS(SELECT 1 FROM legacy_backup_20261013.fitters l JOIN public.fitters f ON f.id=l.id
    WHERE (f.name,f.phone,f.active,f.created_at,f.updated_at,f.van_name)
      IS DISTINCT FROM (l.name,l.phone,l.active,l.created_at,l.created_at,NULL::text)) THEN
    RAISE EXCEPTION 'Customer/fitter fields changed'; END IF;
  IF EXISTS(SELECT 1 FROM (
    SELECT *,count(*) OVER(PARTITION BY session_token) token_count FROM legacy_backup_20261013.slot_holds
  ) l JOIN public.slot_holds h ON h.id=l.id
    WHERE (h.slot_id,h.token,h.expires_at,h.created_at,h.booking_id) IS DISTINCT FROM
      (l.slot_id,CASE WHEN l.token_count=1 THEN l.session_token ELSE 'legacy-hold:'||l.id::text END,l.expires_at,l.created_at,NULL::uuid)) THEN
    RAISE EXCEPTION 'Legacy hold relationship/token/deadline changed'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_backup_20261013.audit_log l JOIN public.audit_logs a ON a.id=l.id
    LEFT JOIN auth.users u ON u.id::text=lower(l.actor)
    WHERE (a.admin_user_id,a.action,a.resource_type,a.resource_id,a.metadata,a.created_at,a.after_state)
    IS DISTINCT FROM (u.id,l.action,coalesce(l.entity,'legacy_unspecified'),l.entity_id,
      jsonb_build_object('legacy_actor',l.actor,'legacy_metadata',l.metadata,'legacy_entity',l.entity),l.created_at,
      jsonb_build_object('legacy_import',true))) THEN
    RAISE EXCEPTION 'Legacy audit actor/metadata changed or receipt state was invented'; END IF;
  IF EXISTS(SELECT 1 FROM legacy_backup_20261013.app_settings l JOIN public.business_settings s ON s.id=l.id
    WHERE (s.deposit_mode,s.deposit_value,s.fitting_fee_pence,s.job_duration_minutes,s.phone,s.cancellation_policy)
      IS DISTINCT FROM (l.deposit_mode,CASE WHEN l.deposit_mode='fixed' THEN l.deposit_fixed ELSE l.deposit_percent END,
        l.fitting_fee,l.job_duration_mins,l.business_phone,l.cancellation_policy)) THEN
    RAISE EXCEPTION 'Historical settings mapping failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.booking_items i LEFT JOIN public.bookings b ON b.id=i.booking_id
    LEFT JOIN public.tyre_products p ON p.id=i.tyre_product_id WHERE b.id IS NULL OR (i.tyre_product_id IS NOT NULL AND p.id IS NULL))
    OR EXISTS(SELECT 1 FROM public.bookings b LEFT JOIN public.booking_slots s ON s.id=b.slot_id WHERE b.slot_id IS NOT NULL AND s.id IS NULL)
    OR EXISTS(SELECT 1 FROM public.inventory i LEFT JOIN public.tyre_products p ON p.id=i.tyre_product_id WHERE p.id IS NULL)
    OR EXISTS(SELECT 1 FROM public.slot_holds h LEFT JOIN public.booking_slots s ON s.id=h.slot_id WHERE s.id IS NULL) THEN
    RAISE EXCEPTION 'Orphan canonical booking/item/slot/product reference'; END IF;
  IF EXISTS(SELECT 1 FROM public.inventory WHERE stock_qty<reserved_qty OR reserved_qty<0
    OR stock_qty::bigint<reserved_qty::bigint+public.live_inventory_held(tyre_product_id)) THEN
    RAISE EXCEPTION 'Stock is below actual reservations'; END IF;
  IF EXISTS(SELECT 1 FROM public.booking_slots WHERE capacity<public.slot_consumption(id)) THEN
    RAISE EXCEPTION 'Existing legacy slot reservations exceed preserved capacity; manual resolution required'; END IF;
  IF EXISTS(SELECT 1 FROM public.business_settings WHERE pricing_configured OR bank_payment_window_minutes IS NOT NULL
    OR bank_name IS NOT NULL OR bank_account_name IS NOT NULL OR sort_code IS NOT NULL OR account_number IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.payments) OR EXISTS(SELECT 1 FROM public.email_outbox) THEN
    RAISE EXCEPTION 'Unapproved pricing, bank configuration, receipt or outbound email was manufactured'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.bookings'::regclass AND tgname='bookings_legacy_preservation'
    AND tgenabled='O' AND tgfoid='legacy_backup_20261013.guard_legacy_booking()'::regprocedure) THEN
    RAISE EXCEPTION 'Legacy booking preservation guard missing'; END IF;
  FOR r IN SELECT unnest(ARRAY['anon','authenticated','service_role']) role_name LOOP
    IF has_schema_privilege(r.role_name,'legacy_backup_20261013','USAGE')
      OR has_schema_privilege(r.role_name,'legacy_source_20261013','USAGE') THEN
      RAISE EXCEPTION 'Archive schema is exposed to a runtime role'; END IF;
    IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('legacy_backup_20261013','legacy_source_20261013') AND c.relkind='r'
      AND has_table_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
      RAISE EXCEPTION 'Archive table grants are exposed to a runtime role'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='legacy_source_20261013'
    AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
      OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN
    RAISE EXCEPTION 'Legacy RPC remains executable by a runtime role'; END IF;
END;
$preservation$;

-- REVIEW REQUIRED BEFORE COMMIT
-- COMMIT;
