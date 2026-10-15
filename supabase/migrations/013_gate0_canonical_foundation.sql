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
