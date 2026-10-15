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
