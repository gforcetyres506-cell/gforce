import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Real PostgreSQL/WASM SQL engine, minimal Auth stand-in. These tests do NOT
// establish cloud Auth, GoTrue, PostgREST, cookie or provider acceptance.
const db = new PGlite({ extensions: { pgcrypto } });
const actors = Object.fromEntries(['normal', 'viewer', 'inactive', 'admin', 'owner'].map((role) =>
  [role, { user: randomUUID(), session: randomUUID() }]));
let product;
before(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id));
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
  `);
  for (const file of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
  // A fresh migration chain supplies no public products or service zones.
  assert.equal((await db.query('select count(*)::integer as n from public.tyre_products')).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::integer as n from public.service_zones')).rows[0].n, 0);
  for (const [role, actor] of Object.entries(actors)) {
    await db.query('insert into auth.users values ($1)', [actor.user]);
    await db.query('insert into auth.sessions values ($1,$2)', [actor.session, actor.user]);
    if (role !== 'normal') await db.query('insert into public.admin_profiles(user_id,name,role,active) values ($1,$2,$3,$4)',
      [actor.user, 'Test only ' + role, role === 'inactive' ? 'admin' : role, role !== 'inactive']);
  }
  await db.exec("insert into public.customers(first_name,last_name,email,phone) values ('Test','Only','test@example.invalid','test-only')");
  const row = await db.query("insert into public.tyre_products(sku,slug,brand,model,width,profile,rim,season,tier) values ('TEST','test','Test only','Test only',205,55,16,'summer','standard') returning id");
  product = row.rows[0].id;
  await db.query('insert into public.inventory(tyre_product_id,stock_qty,reserved_qty,cost_price_pence,selling_price_pence) values ($1,4,2,100,200)', [product]);
});
after(() => db.close());

async function as(role, actor, run) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(actor ? { sub: actor.user, session_id: actor.session, role } : {})]);
  await db.exec('set role ' + role);
  try { return await run(); } finally { await db.exec('reset role'); }
}
const inventoryChange = (actor, stock = 5) => db.query('select * from public.admin_set_inventory($1,$2,$3,$4,null)', [actor.user, actor.session, product, stock]);

test('all ordered migrations replay unchanged; catalog constraints/indexes/policies/grants match', async () => {
  const result = await db.exec(readFileSync('supabase/verification/phase1_catalog_checks.sql', 'utf8'));
  const counts = result.flatMap((r) => r.rows ?? []).filter((r) => 'result' in r);
  assert(counts.length >= 8);
  assert(counts.every((r) => r.result === 'PASS'), JSON.stringify(counts));
});
test('anonymous cannot read customers or invoke privileged functions', async () => {
  await as('anon', null, async () => {
    await assert.rejects(db.query('select * from public.customers'), /permission denied/);
    await assert.rejects(inventoryChange(actors.owner), /permission denied/);
  });
});
for (const role of ['normal', 'inactive', 'viewer', 'admin', 'owner']) {
  test(role + ': RLS reading and direct INSERT/UPDATE/DELETE denial', async () => {
    await as('authenticated', actors[role], async () => {
      const rows = await db.query('select * from public.customers');
      assert.equal(rows.rows.length, ['viewer', 'admin', 'owner'].includes(role) ? 1 : 0);
      await assert.rejects(db.query("insert into public.customers(first_name,last_name,email,phone) values ('Blocked','Test','blocked@example.invalid','test')"), /permission denied/);
      await assert.rejects(db.query("update public.customers set first_name='Blocked'"), /permission denied/);
      await assert.rejects(db.query('delete from public.customers'), /permission denied/);
      await assert.rejects(inventoryChange(actors[role]), /permission denied/);
    });
  });
}
test('server mutation rechecks viewer/inactive/normal and live session', async () => {
  await as('service_role', null, async () => {
    for (const role of ['normal', 'viewer', 'inactive']) await assert.rejects(inventoryChange(actors[role]), /Operational access required/);
    await assert.rejects(inventoryChange({ ...actors.admin, session: randomUUID() }), /Operational access required/);
  });
});
test('admin and owner operational changes persist with atomic audits; stock cannot violate reservations', async () => {
  await as('service_role', null, async () => {
    for (const role of ['admin', 'owner']) assert.equal((await inventoryChange(actors[role], 6)).rows[0].stock_qty, 6);
    await assert.rejects(inventoryChange(actors.admin, 1), /check constraint/);
  });
  assert.equal((await db.query("select count(*)::int as n from public.audit_logs where action='inventory.updated'")).rows[0].n, 2);
  assert.equal((await db.query('select stock_qty from public.inventory')).rows[0].stock_qty, 6);
});
test('only owner can change access; last owner is preserved; role/deactivation changes affect existing tokens', async () => {
  const change = (actor, role, active, target = actors.admin) => db.query('select * from public.owner_set_admin_access($1,$2,$3,$4,$5)', [actor.user, actor.session, target.user, role, active]);
  await as('service_role', null, async () => {
    await assert.rejects(change(actors.admin, 'owner', true), /Owner access required/);
    await assert.rejects(change(actors.owner, 'viewer', false, actors.owner), /last active owner/);
    await change(actors.owner, 'viewer', true);
    await assert.rejects(inventoryChange(actors.admin), /Operational access required/);
    await change(actors.owner, 'admin', false);
  });
  await as('authenticated', actors.admin, async () => assert.equal((await db.query('select * from public.customers')).rows.length, 0));
  await as('service_role', null, () => change(actors.owner, 'admin', true));
});
test('revoked sessions lose RLS reads, context and operational authority immediately', async () => {
  await db.query('delete from auth.sessions where id=$1', [actors.admin.session]);
  await as('authenticated', actors.admin, async () => {
    assert.equal((await db.query('select public.has_live_session() as valid')).rows[0].valid, false);
    assert.equal((await db.query('select * from public.admin_session_context()')).rows.length, 0);
    assert.equal((await db.query('select * from public.customers')).rows.length, 0);
  });
  await as('service_role', null, () => assert.rejects(inventoryChange(actors.admin), /Operational access required/));
});
test('atomic rate limiter and unconfigured pricing are truthful', async () => {
  assert.equal((await db.query('select pricing_configured from public.business_settings')).rows[0].pricing_configured, false);
  await as('service_role', null, async () => {
    const consume = () => db.query("select * from public.consume_rate_limit('test-only',2,1)");
    assert.equal((await consume()).rows[0].remaining, 1);
    assert.equal((await consume()).rows[0].remaining, 0);
    assert.equal((await consume()).rows[0].allowed, false);
  });
});

const importRows = (actor, kind, rows) => db.query('select public.owner_import_business_data($1,$2,$3,$4::jsonb) as saved', [actor.user, actor.session, kind, JSON.stringify(rows)]);
const ownerZone = { postcode_prefix: 'E1', name: 'Test only coverage', callout_fee_pence: 731, priority: 4, active: true };
const ownerProduct = { sku: 'GATE1-TEST', brand: 'Test only', model: 'Import fixture', width: 205, profile: 55, rim: 16,
  load_index: '91', speed_rating: 'V', run_flat: false, extra_load: true, season: 'summer', tier: 'standard',
  wet_grip_rating: 'A', fuel_efficiency_rating: 'B', noise_db: 70, image_url: 'https://example.invalid/test-only.png', active: true,
  inventory: { stock_qty: 6, reserved_qty: 0, cost_price_pence: 321, selling_price_pence: 654, supplier_sku: 'TEST-SUPPLIER', low_stock_threshold: 1 } };
test('owner data import is denied to browser roles and non-owner server actors', async () => {
  for (const role of ['anon','authenticated']) await as(role, role === 'authenticated' ? actors.owner : null,
    () => assert.rejects(importRows(actors.owner,'zones',[ownerZone]), /permission denied/));
  await as('service_role', null, async () => {
    for (const name of ['normal','inactive','viewer','admin']) await assert.rejects(importRows(actors[name],'zones',[ownerZone]), /Owner access required/);
    await assert.rejects(importRows({ ...actors.owner, session: randomUUID() },'zones',[ownerZone]), /Owner access required/);
  });
});
test('owner zone batch saves explicit fields and atomic audits; invalid row rolls back whole batch', async () => {
  await as('service_role', null, async () => {
    assert.equal((await importRows(actors.owner,'zones',[ownerZone])).rows[0].saved, 1);
    const saved = (await db.query("select name,callout_fee_pence,priority,active from public.service_zones where postcode_prefix='E1'")).rows[0];
    assert.deepEqual(saved, { name: ownerZone.name, callout_fee_pence: 731, priority: 4, active: true });
    await assert.rejects(importRows(actors.owner,'zones',[{ ...ownerZone, name: 'Must roll back' }, { ...ownerZone, postcode_prefix: 'E*' }]), /Invalid service zone/);
    assert.equal((await db.query("select name from public.service_zones where postcode_prefix='E1'")).rows[0].name, ownerZone.name);
    assert.equal((await db.query("select count(*)::integer as n from public.audit_logs where action='owner.zone_imported'")).rows[0].n, 1);
  });
});
test('owner catalogue batch persists supplied metadata and preserves reservations', async () => {
  await as('service_role', null, async () => {
    assert.equal((await importRows(actors.owner,'catalogue',[ownerProduct])).rows[0].saved, 1);
    let row = (await db.query("select p.*,i.stock_qty,i.reserved_qty,i.cost_price_pence,i.selling_price_pence,i.supplier_sku from public.tyre_products p join public.inventory i on i.tyre_product_id=p.id where p.sku='GATE1-TEST'")).rows[0];
    assert.equal(row.image_url, ownerProduct.image_url); assert.equal(row.cost_price_pence, 321); assert.equal(row.selling_price_pence, 654); assert.equal(row.extra_load,true);
    await db.query('update public.inventory set reserved_qty=2 where tyre_product_id=$1',[row.id]);
    await assert.rejects(importRows(actors.owner,'catalogue',[{ ...ownerProduct, model:'Must roll back' }]), /Reserved stock changed/);
    await importRows(actors.owner,'catalogue',[{ ...ownerProduct, inventory:{ ...ownerProduct.inventory,reserved_qty:2,stock_qty:8 } }]);
    row=(await db.query('select stock_qty,reserved_qty from public.inventory where tyre_product_id=$1',[row.id])).rows[0];
    assert.deepEqual(row,{ stock_qty:8,reserved_qty:2 });
    await assert.rejects(importRows(actors.owner,'catalogue',[{ ...ownerProduct,sku:'INVENTED-RESERVATION',inventory:{ ...ownerProduct.inventory,reserved_qty:1 } }]), /invented/);
    assert.equal((await db.query("select count(*)::integer as n from public.tyre_products where sku='INVENTED-RESERVATION'")).rows[0].n,0);
  });
});
test('atomic limiter permits at most its limit across queued simultaneous requests', async () => {
  await as('service_role',null,async () => {
    const replies=await Promise.all(Array.from({length:20},()=>db.query("select * from public.consume_rate_limit('gate1-burst-test',3,10)")));
    assert.equal(replies.filter((r)=>r.rows[0].allowed).length,3);
    assert.equal((await db.query("select hits from public.rate_limits where bucket_key='gate1-burst-test'")).rows[0].hits,3);
  });
});
