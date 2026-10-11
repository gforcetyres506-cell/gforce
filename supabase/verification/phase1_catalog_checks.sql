-- Phase 1 live catalogue verification.
-- Run only after migrations 001-018 have been applied from zero to the
-- authorized disposable project. This transaction changes no persistent data
-- and fails closed when an expected catalogue/security property is absent.

begin;
set local search_path = pg_catalog, public;

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

with counts(check_name, actual, expected) as (
  select 'required_tables', count(*)::integer, 22
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname = any(array[
      'admin_profiles', 'customers', 'service_zones', 'tyre_products', 'inventory',
      'availability_rules', 'booking_slots', 'blocked_dates', 'slot_holds',
      'inventory_holds', 'bookings', 'booking_items', 'payments', 'webhook_events',
      'fitters', 'business_settings', 'audit_logs', 'vrm_cache',
      'interest_registrations', 'rate_limits', 'email_outbox', 'special_dates'
    ])
  union all
  select 'rls_enabled', count(*)::integer, 22
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and c.relname = any(array[
      'admin_profiles', 'customers', 'service_zones', 'tyre_products', 'inventory',
      'availability_rules', 'booking_slots', 'blocked_dates', 'slot_holds',
      'inventory_holds', 'bookings', 'booking_items', 'payments', 'webhook_events',
      'fitters', 'business_settings', 'audit_logs', 'vrm_cache',
      'interest_registrations', 'rate_limits', 'email_outbox', 'special_dates'
    ])
  union all
  select 'primary_keys', count(*)::integer, 22
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  join pg_namespace n on n.oid = r.relnamespace
  where n.nspname = 'public' and c.contype = 'p'
    and r.relname = any(array[
      'admin_profiles', 'customers', 'service_zones', 'tyre_products', 'inventory',
      'availability_rules', 'booking_slots', 'blocked_dates', 'slot_holds',
      'inventory_holds', 'bookings', 'booking_items', 'payments', 'webhook_events',
      'fitters', 'business_settings', 'audit_logs', 'vrm_cache',
      'interest_registrations', 'rate_limits', 'email_outbox', 'special_dates'
    ])
  union all
  select 'unique_constraints', count(*)::integer, 20
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  join pg_namespace n on n.oid = r.relnamespace
  where n.nspname = 'public' and c.contype = 'u'
    and r.relname = any(array[
      'admin_profiles', 'customers', 'service_zones', 'tyre_products', 'inventory',
      'availability_rules', 'booking_slots', 'blocked_dates', 'slot_holds',
      'inventory_holds', 'bookings', 'booking_items', 'payments', 'webhook_events',
      'fitters', 'business_settings', 'audit_logs', 'vrm_cache',
      'interest_registrations', 'rate_limits', 'email_outbox', 'special_dates'
    ])
  union all
  select 'check_constraints', count(*)::integer, 66
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  join pg_namespace n on n.oid = r.relnamespace
  where n.nspname = 'public' and c.contype = 'c'
    and r.relname = any(array[
      'admin_profiles', 'customers', 'service_zones', 'tyre_products', 'inventory',
      'availability_rules', 'booking_slots', 'blocked_dates', 'slot_holds',
      'inventory_holds', 'bookings', 'booking_items', 'payments', 'webhook_events',
      'fitters', 'business_settings', 'audit_logs', 'vrm_cache',
      'interest_registrations', 'rate_limits', 'email_outbox', 'special_dates'
    ])
  union all
  select 'foreign_keys', count(*)::integer, 18
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  join pg_namespace n on n.oid = r.relnamespace
  where n.nspname = 'public' and c.contype = 'f'
    and r.relname = any(array[
      'admin_profiles', 'customers', 'service_zones', 'tyre_products', 'inventory',
      'availability_rules', 'booking_slots', 'blocked_dates', 'slot_holds',
      'inventory_holds', 'bookings', 'booking_items', 'payments', 'webhook_events',
      'fitters', 'business_settings', 'audit_logs', 'vrm_cache',
      'interest_registrations', 'rate_limits', 'email_outbox', 'special_dates'
    ])
  union all
  select 'required_named_indexes', count(*)::integer, 25
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_index i on i.indexrelid = c.oid
  where n.nspname = 'public' and c.relkind = 'i' and i.indisvalid and i.indisready
    and c.relname = any(array[
      'idx_admin_profiles_user_id', 'idx_customers_email',
      'idx_service_zones_prefix_priority', 'idx_tyre_products_size',
      'idx_inventory_product', 'idx_booking_slots_date_active',
      'idx_slot_holds_slot', 'idx_slot_holds_expires_at',
      'idx_inventory_holds_product', 'idx_inventory_holds_expires_at',
      'idx_bookings_reference', 'idx_bookings_slot_id', 'idx_bookings_status',
      'idx_bookings_created_at', 'idx_booking_items_booking_id',
      'idx_payments_booking_id', 'idx_payments_manual_booking', 'idx_audit_logs_created_at',
      'idx_vrm_cache_lookup_expires', 'idx_rate_limits_expires_at',
      'idx_email_outbox_dispatch', 'idx_email_outbox_booking',
      'idx_bookings_bank_expiry', 'idx_inventory_holds_live_product',
      'idx_special_dates_date_active'
    ])
  union all
  select 'required_policies', count(*)::integer, 25
  from pg_policies
  where schemaname = 'public'
)
select check_name, actual, expected,
       case when actual = expected then 'PASS' else 'FAIL' end as result
from counts
order by check_name;

select r.relname as table_name, c.conname, c.contype, c.convalidated,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class r on r.oid = c.conrelid
join pg_namespace n on n.oid = r.relnamespace
where n.nspname = 'public'
order by r.relname, c.contype, c.conname;

select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

rollback;
