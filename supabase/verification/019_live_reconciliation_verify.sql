-- Read-only: sanitized counts and names only. Run immediately after the reviewed reconciliation,
-- before reopening writes. Any failure raises an exception. No customer values are selected.
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog, public;
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

SELECT 'LEGACY_RECONCILIATION_LOCAL_OR_REVIEWED_TARGET' AS scope, 'PASS' AS result;
SELECT table_name, source_count AS preserved_source_rows FROM legacy_backup_20261013.reconciliation_manifest ORDER BY table_name;
SELECT 'auth_users' AS check_name, (SELECT count(*) FROM auth.users) AS actual, 'PASS' AS result;
SELECT 'required_tables' AS check_name, count(*) AS actual, 'PASS' AS result FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname=ANY(ARRAY['admin_profiles','customers','service_zones','tyre_products','inventory','availability_rules','booking_slots','blocked_dates','slot_holds','inventory_holds','bookings','booking_items','payments','webhook_events','fitters','business_settings','audit_logs','vrm_cache','interest_registrations','rate_limits','email_outbox','special_dates']);
ROLLBACK;
