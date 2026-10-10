import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const url = new URL(process.env.GATE2_TEST_DATABASE_URL ?? 'http://missing.invalid');
assert.equal(url.hostname, '127.0.0.1', 'Only the runner-created local disposable instance is allowed');
assert(process.env.GATE2_LOCAL_DATA_DIR, 'Use npm run test:concurrency');
const connect = async (name = 'gate2-test') => {
  const db = new pg.Client({ connectionString: url.toString(), application_name: name, connectionTimeoutMillis: 5000 });
  await db.connect(); return db;
};
let db, zone, expiryCase;
const evidence = { scope: 'LOCAL_REAL_POSTGRESQL_ONLY', started_at: new Date().toISOString(), races: [] };
const customer = { name: 'Concurrency Test Only', email: 'atomic@example.invalid', phone: '+441632960001', address_line1: 'Test fixture only' };
const call = (client, slot, items, key = randomUUID(), extra = {}) => client.query(
  'select * from public.reserve_booking_checkout($1,$2,$3::jsonb,$4::jsonb,$5,$6::jsonb,$7)',
  [key, slot, JSON.stringify(items), JSON.stringify(customer), 'E14 8PX', '{}', null].map((v, i) => extra[i] ?? v));
async function product(stock = 100, price = 12345, reserved = 0) {
  const id = randomUUID();
  await db.query("insert into public.tyre_products(id,sku,slug,brand,model,width,profile,rim,tier,season) values ($1,$2,$2,'Test only','Atomic fixture',205,55,16,'standard','summer')", [id,'TEST-'+id]);
  await db.query('insert into public.inventory(tyre_product_id,stock_qty,reserved_qty,cost_price_pence,selling_price_pence) values ($1,$2,$3,100,$4)',[id,stock,reserved,price]);
  return id;
}
let timeIndex = 0;
async function slot(capacity = 1) {
  return (await db.query("insert into public.booking_slots(date,start_at,end_at,capacity) values (current_date+2, time '00:00'+$1*interval '10 minutes', time '00:00'+($1+1)*interval '10 minutes',$2) returning id", [timeIndex++,capacity])).rows[0].id;
}
const item = (id, quantity = 1) => ({ tyre_id: id, quantity });
async function counts() {
  return (await db.query(`select
    (select count(*)::int from public.customers) customers,
    (select count(*)::int from public.bookings) bookings,
    (select count(*)::int from public.booking_items) items,
    (select count(*)::int from public.slot_holds) slots,
    (select count(*)::int from public.inventory_holds) inventory,
    (select count(*)::int from public.payments) payments`)).rows[0];
}
before(async () => {
  db = await connect();
  const target = (await db.query("select current_setting('data_directory') directory,version() version")).rows[0];
  assert.equal(resolve(target.directory),resolve(process.env.GATE2_LOCAL_DATA_DIR));
  assert(resolve(target.directory).startsWith(resolve('.local-postgres') + (process.platform === 'win32' ? '\\' : '/')));
  evidence.postgresql_version = target.version;
  evidence.target_attestation = 'PASS: runner-created local directory; loopback only; no cloud connection';
  await db.query(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;`);
  evidence.migrations = [];
  for (const file of readdirSync('supabase/migrations').sort()) {
    const sql = readFileSync('supabase/migrations/'+file,'utf8');
    await db.query(sql); evidence.migrations.push({ file, sha256: createHash('sha256').update(sql).digest('hex') });
  }
  await db.query("update public.business_settings set pricing_configured=true,fitting_fee_pence=1700,job_duration_minutes=10,cancellation_policy='Test only',deposit_mode='percent',deposit_value=25,bank_payment_window_minutes=1");
  zone = (await db.query("insert into public.service_zones(name,postcode_prefix,callout_fee_pence) values ('Test only','E14',731) returning id")).rows[0].id;
  await db.query('update public.business_settings set bank_payment_window_minutes=120');
});
after(async () => {
  if (db) {
    const negatives = (await db.query('select count(*)::int n from public.inventory where stock_qty<0 or reserved_qty<0 or stock_qty<reserved_qty')).rows[0].n;
    assert.equal(negatives,0); evidence.negative_inventory_rows = negatives;
    const oversold = (await db.query('select count(*)::int n from public.inventory where stock_qty::bigint-reserved_qty-public.live_inventory_held(tyre_product_id)<0')).rows[0].n;
    const oversoldSlots = (await db.query('select count(*)::int n from public.booking_slots where capacity<public.slot_consumption(id)')).rows[0].n;
    assert.equal(oversold,0);assert.equal(oversoldSlots,0);
    evidence.oversold_inventory_rows=oversold;evidence.oversold_slot_rows=oversoldSlots;
    evidence.finished_at = new Date().toISOString();
    await db.end();
    // Written only as evidence of actual results, never used to skip tests.
    writeFileSync('.local-postgres/gate2-postgres-evidence.json',JSON.stringify(evidence,null,2)+'\n');
  }
});

async function race(name, slots, carts, blockQuery, blockArgs, expectedCode, successes = 1, keys) {
  const blocker = await connect('gate2-blocker');
  const clients = await Promise.all(Array.from({length:20},(_,i)=>connect('gate2-race-'+name+'-'+i)));
  let outcomes;
  try {
    const pids = await Promise.all(clients.map(async client => {
      await client.query("begin; set local role service_role; set local lock_timeout='15s'; set local statement_timeout='20s'");
      return (await client.query('select pg_backend_pid() pid')).rows[0].pid;
    }));
    assert.equal(new Set(pids).size,20);
    await blocker.query('begin'); await blocker.query(blockQuery,blockArgs);
    const requests = clients.map(async (client,i)=>{
      try { const result = await call(client,slots[i],carts[i],keys?.[i]); await client.query('commit'); return { ok:true,booking:result.rows[0] }; }
      catch(error){ await client.query('rollback'); return { ok:false,code:error.code,message:error.message }; }
    });
    let waiters = 0;
    for(let attempt=0;attempt<100;attempt++) {
      waiters = (await db.query("select count(*)::int n from pg_stat_activity where application_name like $1 and wait_event_type='Lock'",['gate2-race-'+name+'-%'])).rows[0].n;
      if(waiters===20) break;
      await delay(30);
    }
    // Release even if observation failed so pending clients can be closed.
    await blocker.query('commit'); outcomes=await Promise.all(requests);
    assert.equal(waiters,20,'All 20 real sessions must overlap while waiting on a database lock');
    assert.equal(outcomes.filter(o=>o.ok).length,successes,JSON.stringify(outcomes));
    assert.equal(outcomes.filter(o=>!o.ok&&o.code===expectedCode).length,20-successes,JSON.stringify(outcomes));
    const row = { name,independent_connections:20,simultaneous_lock_waiters:waiters,successes,failures:20-successes,failure_code:expectedCode??null };
    evidence.races.push(row); console.log('RACE PASS '+JSON.stringify(row));
    return outcomes;
  } finally { await blocker.query('rollback').catch(()=>{}); await Promise.all(clients.map(c=>c.end())); await blocker.end(); }
}
test('all 16 ordered migrations and exact security catalogue replay on native PostgreSQL',async()=>{
  const result = await db.query(readFileSync('supabase/verification/phase1_catalog_checks.sql','utf8'));
  const rows=result.flatMap(r=>r.rows??[]).filter(r=>'result' in r);
  assert(rows.length>=8); assert(rows.every(r=>r.result==='PASS')); evidence.schema='PASS';
});
test('capacity=1: 20 simultaneous sessions produce exactly 1 success and 19 conflicts',async()=>{
  const p=await product(),s=await slot(1),before=await counts();
  await race('slot',Array(20).fill(s),Array(20).fill([item(p)]),'select id from public.booking_slots where id=$1 for update',[s],'P2002');
  const now=await counts(); assert.equal(now.bookings-before.bookings,1);assert.equal(now.customers-before.customers,1);assert.equal(now.slots-before.slots,1);assert.equal(now.inventory-before.inventory,1);
  assert.equal((await db.query('select public.slot_consumption($1)::int n',[s])).rows[0].n,1);
});
test('stock=2, qty=2: 20 independent slots produce exactly 1 success and 19 out_of_stock',async()=>{
  const p=await product(2),slots=[];for(let i=0;i<20;i++)slots.push(await slot());
  await race('inventory',slots,Array(20).fill([item(p,2)]),'select id from public.inventory where tyre_product_id=$1 for update',[p],'P2003');
  assert.equal((await db.query('select public.live_inventory_held($1)::int n',[p])).rows[0].n,2);
});
test('reverse-order multi-item carts serialize without deadlocks, partial reservations or negative inventory',async()=>{
  const a=await product(2),b=await product(2),slots=[];for(let i=0;i<20;i++)slots.push(await slot());
  const carts=Array.from({length:20},(_,i)=>i%2?[item(b,2),item(a,2)]:[item(a,2),item(b,2)]);
  await race('multi',slots,carts,'select id from public.inventory where tyre_product_id=any($1::uuid[]) order by tyre_product_id for update',[[a,b]],'P2003');
  for(const p of [a,b])assert.equal((await db.query('select public.live_inventory_held($1)::int n',[p])).rows[0].n,2);
});
test('concurrent retries create exactly one booking, customer and pair of holds',async()=>{
  const p=await product(2),s=await slot(),key=randomUUID(),before=await counts();
  const result=await race('retry',Array(20).fill(s),Array(20).fill([item(p,2)]),'select pg_advisory_xact_lock(hashtextextended($1,0))',[key],null,20,Array(20).fill(key));
  assert.equal(new Set(result.map(r=>r.booking.booking_id)).size,1);
  const now=await counts();for(const field of ['bookings','customers','slots','inventory','items'])assert.equal(now[field]-before[field],1);
  await assert.rejects(call(db,s,[item(p)],key),{code:'P2005'});
});
test('prices and rounded integer-pence totals come from locked database rows; items/terms are immutable',async()=>{
  const p=await product(4,12345,1),s=await slot(); const booked=(await call(db,s,[item(p,2)])).rows[0];
  assert.equal(booked.status,'AWAITING_BANK_PAYMENT');assert.equal(booked.total_pence,27121);assert.equal(booked.deposit_pence,6780);assert.equal(booked.balance_pence,20341);
  await assert.rejects(db.query('update public.booking_items set unit_price_pence=1 where booking_id=$1',[booked.booking_id]),{code:'55000'});
  await assert.rejects(db.query('delete from public.booking_items where booking_id=$1',[booked.booking_id]),{code:'55000'});
  await assert.rejects(db.query('update public.bookings set total_pence=1 where id=$1',[booked.booking_id]),{code:'55000'});
  await assert.rejects(db.query("update public.bookings set status='confirmed' where id=$1",[booked.booking_id]),{code:'55000'});
  await assert.rejects(db.query('update public.inventory set stock_qty=2 where tyre_product_id=$1',[p]),{code:'23514'});
  assert.equal((await counts()).payments,0); evidence.authoritative_pricing_and_immutability='PASS';
});
test('failure after customer/booking/hold inserts rolls back every write',async()=>{
  const p=await product(),s=await slot(),before=await counts();
  await db.query("create function public.test_only_injected_failure() returns trigger language plpgsql as $$ begin raise exception 'injected late failure'; end $$; create trigger test_only_late_failure before insert on public.booking_items for each row execute function public.test_only_injected_failure()");
  try { await assert.rejects(call(db,s,[item(p)]),/injected late failure/); }
  finally { await db.query('drop trigger test_only_late_failure on public.booking_items; drop function public.test_only_injected_failure()'); }
  assert.deepEqual(await counts(),before); evidence.full_rollback='PASS';
});
test('multi-item shortage and duplicate quantities cannot leak partial holds',async()=>{
  const a=await product(8),b=await product(1),s=await slot(),before=await counts();
  await assert.rejects(call(db,s,[item(a,2),item(b,2)]),{code:'P2003'});
  await assert.rejects(call(db,s,[item(b),item(b)]),{code:'P2003'});
  await assert.rejects(call(db,s,[{...item(a),price:1}]),{code:'P2001'});
  assert.deepEqual(await counts(),before);
});
test('unconfigured bank window and uncovered postcode reject before any persistent reservation',async()=>{
  const p=await product(),s=await slot(),before=await counts();
  await db.query('update public.business_settings set bank_payment_window_minutes=null');
  try { await assert.rejects(call(db,s,[item(p)]),{code:'P2004'}); }
  finally { await db.query('update public.business_settings set bank_payment_window_minutes=120'); }
  await db.query('update public.service_zones set active=false where id=$1',[zone]);
  try { await assert.rejects(call(db,s,[item(p)]),{code:'P2006'}); }
  finally { await db.query('update public.service_zones set active=true where id=$1',[zone]); }
  assert.deepEqual(await counts(),before);
});
test('anonymous and authenticated browsers cannot execute reservation or expiry RPCs',async()=>{
  for(const role of ['anon','authenticated']) {
    await db.query('set role '+role);
    try {await assert.rejects(call(db,randomUUID(),[item(randomUUID())]),{code:'42501'});await assert.rejects(db.query('select public.expire_unpaid_bookings()'),{code:'42501'});}
    finally {await db.query('reset role');}
  }
});
test('operational capacity changes cannot shrink a slot below live bookings',async()=>{
  const p=await product(4),s=await slot(2);
  await call(db,s,[item(p)]);await call(db,s,[item(p)]);
  await assert.rejects(db.query('update public.booking_slots set capacity=1 where id=$1',[s]),{code:'23514'});
  assert.equal((await db.query('select capacity from public.booking_slots where id=$1',[s])).rows[0].capacity,2);
});
test('real unpaid deadline releases both resources before cleanup; next checkout persists EXPIRED',async()=>{
  // Isolate this reservation from other checkouts' lazy expiry maintenance.
  const p=await product(2),s=await slot(),key=randomUUID();
  await db.query('update public.business_settings set bank_payment_window_minutes=1');
  try { expiryCase={p,s,key,reservation:(await call(db,s,[item(p,2)],key)).rows[0]}; }
  finally { await db.query('update public.business_settings set bank_payment_window_minutes=120'); }
  // pg returns timestamptz as Date. Date.parse(Date) first stringifies it,
  // dropping milliseconds; a host-clock wait can fire before the DB deadline.
  // Use the authoritative DB clock, preserving fractional seconds throughout.
  for (;;) {
    const remaining=Number((await db.query('select extract(epoch from (bank_payment_expires_at-clock_timestamp()))*1000 remaining from public.bookings where id=$1',[expiryCase.reservation.booking_id])).rows[0].remaining);
    if(remaining<=0)break;
    await delay(Math.min(remaining+25,5000));
  }
  // No cleanup has run. Prove resources are already free using DB time.
  assert.equal((await db.query('select status from public.bookings where id=$1',[expiryCase.reservation.booking_id])).rows[0].status,'AWAITING_BANK_PAYMENT');
  assert.equal((await db.query('select public.live_inventory_held($1)::int n',[expiryCase.p])).rows[0].n,0);
  assert.equal((await db.query('select public.slot_consumption($1)::int n',[expiryCase.s])).rows[0].n,0);
  const next=(await call(db,expiryCase.s,[item(expiryCase.p,2)])).rows[0];assert.equal(next.status,'AWAITING_BANK_PAYMENT');
  assert.equal((await db.query('select status from public.bookings where id=$1',[expiryCase.reservation.booking_id])).rows[0].status,'EXPIRED');
  const retry=(await call(db,expiryCase.s,[item(expiryCase.p,2)],expiryCase.key)).rows[0];assert.equal(retry.status,'EXPIRED');assert.equal(retry.booking_id,expiryCase.reservation.booking_id);
  evidence.expiry_without_cron='PASS';
});
