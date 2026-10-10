import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const url = new URL(process.env.GATE2_TEST_DATABASE_URL ?? 'http://missing.invalid');
assert.equal(url.hostname,'127.0.0.1');assert(process.env.GATE2_LOCAL_DATA_DIR);
const connect=async(name='gate3-test')=>{const c=new pg.Client({connectionString:url.toString(),application_name:name});await c.connect();return c;};
let db,index=0,legacyId;
const evidence={scope:'LOCAL_REAL_POSTGRESQL_ONLY',started_at:new Date().toISOString(),migrations:[],races:[]};
const actors=Object.fromEntries(['normal','viewer','inactive','admin','owner'].map(r=>[r,{user:randomUUID(),session:randomUUID()}]));
const customer={name:'Test Only',email:'bank@example.invalid',phone:'+441632960001',address_line1:'Test fixture only'};
const bank={bank_name:'Test fixture bank',bank_account_name:'Test only',sort_code:'000000',account_number:'00000000'};
async function product(stock=2){const id=randomUUID();await db.query("insert into public.tyre_products(id,sku,slug,brand,model,width,profile,rim,tier,season) values($1::uuid,$1::text,'test-'||$1::text,'Test','Only',205,55,16,'standard','summer')",[id]);await db.query('insert into public.inventory(tyre_product_id,stock_qty,reserved_qty,cost_price_pence,selling_price_pence) values($1,$2,0,100,12345)',[id,stock]);return id;}
async function slot(capacity=1){return(await db.query("insert into public.booking_slots(date,start_at,end_at,capacity) values(current_date+2,time '00:00'+$1*interval '10 minutes',time '00:00'+($1+1)*interval '10 minutes',$2) returning id",[index++,capacity])).rows[0].id;}
const reserve=async(c,s,p,key=randomUUID(),phone=false)=>{
 const args=[key,s,JSON.stringify([{tyre_id:p,quantity:2}]),JSON.stringify(customer),'E14 8PX','{}',null];
 return(await c.query(phone?'select * from public.admin_reserve_phone_booking($8,$9,$1,$2,$3::jsonb,$4::jsonb,$5,$6::jsonb,$7)':'select * from public.reserve_booking_checkout($1,$2,$3::jsonb,$4::jsonb,$5,$6::jsonb,$7)',phone?[...args,actors.admin.user,actors.admin.session]:args)).rows[0];
};
async function booking(phone=false){const p=await product(),s=await slot(),key=randomUUID();return{p,s,key,b:await reserve(db,s,p,key,phone)};}
const verify=(c,b,actor=actors.admin,amount=b.total_pence)=>c.query('select * from public.admin_verify_bank_payment($1,$2,$3,$4)',[actor.user,actor.session,b.booking_id,amount]);
const extend=(c,b,actor=actors.admin,minutes=10,expected=b.expires_at)=>c.query('select public.admin_extend_bank_window($1,$2,$3,$4,$5,$6) deadline',[actor.user,actor.session,b.booking_id,minutes,'Test explicit extension',expected]);
const payment=async b=>(await db.query("select * from public.payments where booking_id=$1 and provider='manual'",[b.booking_id])).rows[0];
const audits=async(b,action)=>(await db.query('select * from public.audit_logs where resource_id=$1 and action=$2',[b.booking_id,action])).rows;
before(async()=>{
 db=await connect();const target=(await db.query("select current_setting('data_directory') directory,version() version")).rows[0];
 assert.equal(resolve(target.directory),resolve(process.env.GATE2_LOCAL_DATA_DIR));assert(resolve(target.directory).startsWith(resolve('.local-postgres')));
 evidence.postgresql_version=target.version;evidence.target_attestation='PASS: fresh runner-created loopback database; no cloud';
 await db.query(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`);
 for(const file of readdirSync('supabase/migrations').sort()){
  if(file==='017_gate3_manual_bank_payments.sql')legacyId=(await db.query("insert into public.bookings(reference,fitting_address,postcode,subtotal_pence,fitting_fee_pence,callout_fee_pence,total_pence,deposit_pence,balance_pence) values('GF-LEGACY-TEST-ONLY','Test fixture','E14 8PX',0,0,0,0,0,0) returning id")).rows[0].id;
  const sql=readFileSync('supabase/migrations/'+file,'utf8');await db.query(sql);evidence.migrations.push({file,sha256:createHash('sha256').update(sql).digest('hex')});}
 for(const[role,a]of Object.entries(actors)){await db.query('insert into auth.users values($1)',[a.user]);await db.query('insert into auth.sessions values($1,$2)',[a.session,a.user]);if(role!=='normal')await db.query('insert into public.admin_profiles(user_id,name,role,active) values($1,$2,$3,$4)',[a.user,'Test '+role,role==='inactive'?'admin':role,role!=='inactive']);}
 await db.query("update public.business_settings set pricing_configured=true,fitting_fee_pence=1700,job_duration_minutes=10,cancellation_policy='Test',deposit_mode='percent',deposit_value=25,bank_payment_window_minutes=120");
 await db.query("insert into public.service_zones(name,postcode_prefix,callout_fee_pence) values('Test','E14',731)");
});
after(async()=>{
 if(db){const inv=(await db.query('select count(*)::int n from public.inventory where reserved_qty<0 or stock_qty-reserved_qty-public.live_inventory_held(tyre_product_id)<0')).rows[0].n;
 const slots=(await db.query('select count(*)::int n from public.booking_slots where capacity<public.slot_consumption(id)')).rows[0].n;assert.equal(inv,0);assert.equal(slots,0);
 evidence.oversold_inventory_rows=inv;evidence.oversold_slot_rows=slots;evidence.finished_at=new Date().toISOString();writeFileSync('.local-postgres/gate3-postgres-evidence.json',JSON.stringify(evidence,null,2)+'\n');await db.end();}
});
test('17 migrations replay and catalogue security checks pass',async()=>{const result=await db.query(readFileSync('supabase/verification/phase1_catalog_checks.sql','utf8'));assert(result.flatMap(r=>r.rows??[]).filter(r=>'result'in r).every(r=>r.result==='PASS'));});
test('forward upgrade preserves unknown historical source and invents no legacy payment',async()=>{
 const row=(await db.query('select booking_source from public.bookings where id=$1',[legacyId])).rows[0];assert.equal(row.booking_source,null);
 assert.equal((await db.query('select count(*)::int n from public.payments where booking_id=$1',[legacyId])).rows[0].n,0);
 evidence.legacy_upgrade='PASS: unknown source stays null; no invented payment';
});
test('bank details absent block reservation with zero writes; only a live owner can configure',async()=>{
 const p=await product(),s=await slot();await assert.rejects(reserve(db,s,p),{code:'P3001'});
 assert.equal((await db.query('select count(*)::int n from public.bookings')).rows[0].n,1);
 const configure=a=>db.query('select public.owner_set_bank_settings($1,$2,$3,$4,$5,$6,$7)',[a.user,a.session,bank.bank_account_name,bank.bank_name,bank.sort_code,bank.account_number,120]);
 for(const role of ['normal','viewer','inactive','admin'])await assert.rejects(configure(actors[role]),{code:'42501'});
 await configure(actors.owner);assert.equal((await db.query("select count(*)::int n from public.audit_logs where action='bank.settings_updated'")).rows[0].n,1);
});
test('online and phone reserve full total as pending, with snapshots and no Stripe identifiers',async()=>{
 for(const phone of [false,true]){const{b}=await booking(phone),p=await payment(b);assert.equal(b.status,'AWAITING_BANK_PAYMENT');assert.equal(b.total_pence,27121);assert.equal(b.deposit_pence,b.total_pence);assert.equal(b.balance_pence,0);
 assert.equal(p.amount_pence,b.total_pence);assert.equal(p.reference,b.reference);assert.equal(p.payment_method,'bank_transfer');assert.equal(p.status,'pending');assert.equal(p.paid_at,null);assert.equal(p.verified_by_admin_id,null);assert.equal(p.stripe_payment_intent_id,null);assert.equal(p.stripe_checkout_session_id,null);assert.deepEqual(p.bank_details,bank);
 assert.equal((await db.query('select booking_source from public.bookings where id=$1',[b.booking_id])).rows[0].booking_source,phone?'phone':'online');}
});
test('customer/browser/viewer/inactive/revoked actors cannot verify, extend, phone book or email',async()=>{
 const{b,p,s}=await booking();
 for(const role of ['anon','authenticated']){await db.query('set role '+role);try{await assert.rejects(verify(db,b),{code:'42501'});await assert.rejects(db.query("update public.payments set status='received' where booking_id=$1",[b.booking_id]),{code:'42501'});await assert.rejects(extend(db,b),{code:'42501'});await assert.rejects(reserve(db,s,p,randomUUID(),true),{code:'42501'});}finally{await db.query('reset role');}}
 for(const role of ['normal','viewer','inactive']){await assert.rejects(verify(db,b,actors[role]),{code:'42501'});await assert.rejects(extend(db,b,actors[role]),{code:'42501'});await assert.rejects(db.query('select public.admin_claim_bank_email($1,$2,$3)',[actors[role].user,actors[role].session,b.booking_id]),{code:'42501'});}
 await assert.rejects(verify(db,b,{...actors.admin,session:randomUUID()}),{code:'42501'});assert.equal((await payment(b)).status,'pending');
});
test('direct payment and booking updates cannot manufacture receipt; wrong amount rejected',async()=>{
 const{b}=await booking();await assert.rejects(verify(db,b,actors.admin,1),{code:'P3003'});
 await assert.rejects(db.query("update public.payments set status='received',paid_at=now(),verified_by_admin_id=(select id from public.admin_profiles where user_id=$2) where booking_id=$1",[b.booking_id,actors.admin.user]),{code:'55000'});
 await assert.rejects(db.query("update public.bookings set status='CONFIRMED' where id=$1",[b.booking_id]),{code:'55000'});
});
test('admin and owner receipt transaction confirms, converts stock once and writes one audit',async()=>{
 for(const actor of [actors.admin,actors.owner]){const{b,p,s}=await booking();const receipt=(await verify(db,b,actor)).rows[0];assert.equal(receipt.status,'received');assert(receipt.paid_at);assert(receipt.verified_by_admin_id);
 assert.equal((await db.query('select status from public.bookings where id=$1',[b.booking_id])).rows[0].status,'CONFIRMED');
 assert.equal((await db.query('select reserved_qty from public.inventory where tyre_product_id=$1',[p])).rows[0].reserved_qty,2);
 assert.equal((await db.query('select public.live_inventory_held($1)::int n',[p])).rows[0].n,0);assert.equal((await db.query('select public.slot_consumption($1)::int n',[s])).rows[0].n,1);
 assert.deepEqual((await verify(db,b,actor)).rows[0].paid_at,receipt.paid_at);assert.equal((await audits(b,'payment.bank_received')).length,1);
 await assert.rejects(extend(db,b),{code:'P3004'});await assert.rejects(reserve(db,await slot(),p),{code:'P2003'});}
});
test('20 simultaneous verification retries allocate once and produce exactly one receipt audit',async()=>{
 const{b,p}=await booking(),clients=await Promise.all(Array.from({length:20},(_,i)=>connect('gate3-verify-'+i))),blocker=await connect('gate3-blocker');
 try{await blocker.query('begin');await blocker.query('select id from public.bookings where id=$1 for update',[b.booking_id]);
 const pending=clients.map(c=>verify(c,b));let waiters=0;for(let i=0;i<100;i++){waiters=(await db.query("select count(*)::int n from pg_stat_activity where application_name like 'gate3-verify-%' and wait_event_type='Lock'")).rows[0].n;if(waiters===20)break;await delay(30);}
 await blocker.query('commit');const rows=await Promise.all(pending);assert.equal(waiters,20);assert.equal(rows.length,20);assert.equal(new Set(rows.map(r=>r.rows[0].paid_at.toISOString())).size,1);assert.equal((await audits(b,'payment.bank_received')).length,1);assert.equal((await db.query('select reserved_qty from public.inventory where tyre_product_id=$1',[p])).rows[0].reserved_qty,2);
 evidence.races.push({name:'duplicate verification',independent_connections:20,simultaneous_lock_waiters:20,successful_idempotent_responses:20,receipt_audits:1});
 }finally{await blocker.query('rollback');await Promise.all(clients.map(c=>c.end()));await blocker.end();}
});
test('late audit failure rolls back receipt, booking, stock conversion and hold expiry',async()=>{
 const{b,p}=await booking();await db.query("create function public.test_only_audit_failure() returns trigger language plpgsql as $$begin if new.action='payment.bank_received' then raise exception 'Test injected audit failure';end if;return new;end$$;create trigger test_only_audit_failure before insert on public.audit_logs for each row execute function public.test_only_audit_failure()");
 try{await assert.rejects(verify(db,b),/Test injected audit failure/);}finally{await db.query('drop trigger test_only_audit_failure on public.audit_logs;drop function public.test_only_audit_failure()');}
 assert.equal((await payment(b)).status,'pending');assert.equal((await db.query('select reserved_qty from public.inventory where tyre_product_id=$1',[p])).rows[0].reserved_qty,0);assert.equal((await db.query('select public.live_inventory_held($1)::int n',[p])).rows[0].n,2);
});
test('explicit extension updates both deadlines and audits reason; stale retry does not extend twice',async()=>{
 const{b}=await booking(),old=new Date(b.expires_at).getTime(),deadline=(await extend(db,b)).rows[0].deadline;assert.equal(deadline.getTime()-old,600000);
 const holds=(await db.query('select s.expires_at slot,h.expires_at inventory from public.slot_holds s join public.inventory_holds h on h.slot_hold_id=s.id where s.booking_id=$1',[b.booking_id])).rows[0];assert.equal(holds.slot.getTime(),deadline.getTime());assert.equal(holds.inventory.getTime(),deadline.getTime());
 await assert.rejects(extend(db,b),{code:'P3006'});assert.equal((await audits(b,'payment.window_extended')).length,1);
 await assert.rejects(db.query('update public.bookings set bank_payment_expires_at=now()+interval \'1 day\' where id=$1',[b.booking_id]),{code:'55000'});
});
test('email outbox snapshots instructions, rejects duplicate active send and records only real provider acknowledgement',async()=>{
 const{b}=await booking(),args=[actors.admin.user,actors.admin.session,b.booking_id];const claim=async()=> (await db.query('select * from public.admin_claim_bank_email($1,$2,$3)',args)).rows[0];
 const queued=await claim();assert.equal(queued.status,'processing');assert.equal(queued.payload.amount_pence,b.total_pence);assert.deepEqual(queued.payload.bank_details,bank);
 await assert.rejects(claim(),{code:'P3007'});await db.query('select public.finish_bank_email($1,$2,null)',[queued.id,queued.attempts]);const retry=await claim();assert.equal(retry.id,queued.id);assert.equal(retry.attempts,2);
 await db.query('select public.finish_bank_email($1,$2,$3)',[retry.id,retry.attempts,'test-provider-acknowledgement']);assert.equal((await claim()).status,'sent');assert.equal((await claim()).attempts,2);
});
test('bank settings changes do not alter existing payment instructions',async()=>{
 const{b}=await booking();await db.query("update public.business_settings set bank_name='Changed test bank'");assert.deepEqual((await payment(b)).bank_details,bank);await db.query('update public.business_settings set bank_name=$1',[bank.bank_name]);
});
test('multi-item bank verification converts every item exactly once',async()=>{
 const a=await product(),b=await product(),s=await slot();
 const reservation=(await db.query('select * from public.reserve_booking_checkout($1,$2,$3::jsonb,$4::jsonb,$5,$6::jsonb,$7)',[randomUUID(),s,JSON.stringify([{tyre_id:b,quantity:2},{tyre_id:a,quantity:2}]),JSON.stringify(customer),'E14 8PX','{}',null])).rows[0];
 await verify(db,reservation);await verify(db,reservation);
 for(const p of [a,b]){assert.equal((await db.query('select reserved_qty from public.inventory where tyre_product_id=$1',[p])).rows[0].reserved_qty,2);assert.equal((await db.query('select public.live_inventory_held($1)::int n',[p])).rows[0].n,0);}
 assert.equal((await audits(reservation,'payment.bank_received')).length,1);
});
test('existing session loses bank verification immediately on role change or deactivation',async()=>{
 const{b}=await booking();
 await db.query("update public.admin_profiles set role='viewer' where user_id=$1",[actors.admin.user]);
 try{await assert.rejects(verify(db,b),{code:'42501'});}finally{await db.query("update public.admin_profiles set role='admin',active=false where user_id=$1",[actors.admin.user]);}
 try{await assert.rejects(verify(db,b),{code:'42501'});}finally{await db.query('update public.admin_profiles set active=true where user_id=$1',[actors.admin.user]);}
 assert.equal((await payment(b)).status,'pending');
});
test('manual payment integrity rejects unsupported states and missing bank snapshot fields',async()=>{
 const{b}=await booking();const p=await payment(b);
 for(const patch of [{status:'succeeded'},{bank_details:{}},{bank_details:{...bank,bank_name:null}},{amount_pence:0},{payment_method:null}]){
  const values={...p,...patch,id:randomUUID(),booking_id:(await booking()).b.booking_id};
  await assert.rejects(db.query("insert into public.payments(id,booking_id,provider,payment_method,type,status,amount_pence,currency,reference,bank_details) values($1,$2,'manual',$3,'deposit',$4,$5,'gbp',$6,$7::jsonb)",[values.id,values.booking_id,values.payment_method,values.status,values.amount_pence,values.reference,JSON.stringify(values.bank_details)]),{code:'23514'});
 }
});
test('real unpaid expiry releases resources without cron, blocks receipt, and can extend only if resources remain free',async()=>{
 await db.query('update public.business_settings set bank_payment_window_minutes=1');
 const free=await booking(),taken=await booking(),stockTaken=await booking();await db.query('update public.business_settings set bank_payment_window_minutes=120');
 for(;;){const remaining=Number((await db.query('select extract(epoch from(bank_payment_expires_at-clock_timestamp()))*1000 n from public.bookings where id=$1',[stockTaken.b.booking_id])).rows[0].n);if(remaining<=0)break;await delay(Math.min(remaining+20,5000));}
 for(const x of [free,taken]){assert.equal((await db.query('select public.live_inventory_held($1)::int n',[x.p])).rows[0].n,0);assert.equal((await db.query('select public.slot_consumption($1)::int n',[x.s])).rows[0].n,0);await assert.rejects(verify(db,x.b),{code:'P3005'});}
 await db.query('select public.expire_unpaid_bookings()');assert.equal((await db.query('select status from public.bookings where id=$1',[free.b.booking_id])).rows[0].status,'EXPIRED');
 await assert.rejects(verify(db,free.b),{code:'P3004'});
 await reserve(db,taken.s,taken.p);await assert.rejects(extend(db,taken.b),{code:'P2002'});assert.equal((await audits(taken.b,'payment.window_extended')).length,0);
 await reserve(db,await slot(),stockTaken.p);await assert.rejects(extend(db,stockTaken.b),{code:'P2003'});assert.equal((await audits(stockTaken.b,'payment.window_extended')).length,0);
 await extend(db,free.b);assert.equal((await db.query('select status from public.bookings where id=$1',[free.b.booking_id])).rows[0].status,'AWAITING_BANK_PAYMENT');await verify(db,free.b);
 evidence.expiry_without_cron='PASS';evidence.expired_receipt_denied='PASS';evidence.expired_extension_reacquires_resources='PASS';
});
test('verification waiting across expiry rejects; a competing real checkout acquires the released resources',async()=>{
 await db.query('update public.business_settings set bank_payment_window_minutes=1');const{b,p,s}=await booking();await db.query('update public.business_settings set bank_payment_window_minutes=120');
 const blocker=await connect('gate3-deadline-blocker'),verifier=await connect('gate3-deadline-verifier'),buyer=await connect('gate3-deadline-buyer');
 let checking,buying;
 try{
  await blocker.query('begin');await blocker.query('select id from public.inventory where tyre_product_id=$1 for update',[p]);
  checking=verify(verifier,b).then(result=>({result}),error=>({error}));
  let waiting=0;for(let i=0;i<100;i++){waiting=(await db.query("select count(*)::int n from pg_stat_activity where application_name='gate3-deadline-verifier' and wait_event_type='Lock'")).rows[0].n;if(waiting===1)break;await delay(20);}assert.equal(waiting,1);
  for(;;){const remaining=Number((await db.query('select extract(epoch from(bank_payment_expires_at-clock_timestamp()))*1000 n from public.bookings where id=$1',[b.booking_id])).rows[0].n);if(remaining<=0)break;await delay(Math.min(remaining+20,5000));}
  buying=reserve(buyer,s,p).then(result=>({result}),error=>({error}));
  for(let i=0;i<100;i++){waiting=(await db.query("select count(*)::int n from pg_stat_activity where application_name in ('gate3-deadline-verifier','gate3-deadline-buyer') and wait_event_type='Lock'")).rows[0].n;if(waiting===2)break;await delay(20);}assert.equal(waiting,2);
  await blocker.query('commit');const checked=await checking,bought=await buying;
  assert.equal(checked.error?.code,'P3005');assert.equal(bought.error,undefined);assert.equal(bought.result.status,'AWAITING_BANK_PAYMENT');assert.equal((await payment(b)).status,'pending');assert.equal((await audits(b,'payment.bank_received')).length,0);
  assert.equal((await db.query('select public.slot_consumption($1)::int n',[s])).rows[0].n,1);assert.equal((await db.query('select public.live_inventory_held($1)::int n',[p])).rows[0].n,2);
  evidence.deadline_lock_recheck='PASS: verifier started live, waited past expiry, rejected; competing checkout succeeded';
 }finally{await blocker.query('rollback');await Promise.allSettled([checking,buying]);await Promise.all([blocker.end(),verifier.end(),buyer.end()]);}
});
