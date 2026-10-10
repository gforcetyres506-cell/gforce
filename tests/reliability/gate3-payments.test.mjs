import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { loadSource, databaseDouble } from './loader.mjs';

const actor={user:{id:randomUUID()},sessionId:randomUUID(),profile:{id:randomUUID(),role:'admin',active:true}};
const booking=randomUUID(),amount=27121;
const request=(body,origin='https://test.invalid')=>new Request('https://test.invalid/api/admin/payments',{method:'POST',headers:{origin},body:JSON.stringify(body)});
const verifyBody={action:'verify',booking_id:booking,expected_amount_pence:amount,bank_receipt_confirmed:true};
function authModules({role='admin',active=true,live=true,user=true}={}){
 return {'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:user?actor.user:null}})},rpc:async name=>name==='has_live_session'?{data:live}:{data:active?[{...actor.profile,user_id:actor.user.id,session_id:actor.sessionId,role}]:[]}})},
 'next/navigation':{redirect:()=>{},forbidden:()=>{}}};
}
function route(result,options={}){const db=databaseDouble(()=>{throw Error('No multi-step mutations');},()=>result);return{db,api:loadSource('src/app/api/admin/payments/route.ts',{db,modules:authModules(options)})};}
for(const[label,options,status]of [['anonymous',{user:false},401],['viewer',{role:'viewer'},403],['normal',{role:'normal'},403],['inactive',{active:false},403],['revoked',{live:false},401]]){
 test('payment route denies '+label+' before privileged access',async()=>{const{api,db}=route({},options);assert.equal((await api.POST(request(verifyBody))).status,status);assert.equal(db.calls.length,0);});
}
test('cross-site verification and missing explicit receipt confirmation are rejected',async()=>{
 const{api,db}=route({});assert.equal((await api.POST(request(verifyBody,'https://attacker.invalid'))).status,403);
 for(const body of [{...verifyBody,bank_receipt_confirmed:false},{...verifyBody,bank_receipt_confirmed:undefined},{...verifyBody,status:'paid'}])assert.equal((await api.POST(request(body))).status,400);
 assert.equal(db.calls.length,0);
});
test('verified bank receipt is bound to current actor, session and exact amount in one RPC',async()=>{
 const data={booking_id:booking,provider:'manual',status:'received',amount_pence:amount,paid_at:new Date().toISOString(),verified_by_admin_id:actor.profile.id};
 const{api,db}=route({data,error:null});assert.equal((await api.POST(request(verifyBody))).status,200);assert.equal(db.calls.length,1);
 assert.equal(db.calls[0].rpc,'admin_verify_bank_payment');assert.deepEqual(db.calls[0].args,{p_actor_user_id:actor.user.id,p_session_id:actor.sessionId,p_booking_id:booking,p_expected_amount_pence:amount});
});
for(const data of [null,{}, {booking_id:booking,status:'pending'}, {booking_id:booking,provider:'manual',status:'received',amount_pence:1,paid_at:new Date().toISOString(),verified_by_admin_id:actor.profile.id}]){
 test('malformed or mismatched bank receipt cannot report verified '+JSON.stringify(data),async()=>{const{api}=route({data,error:null});assert.equal((await api.POST(request(verifyBody))).status,503);});
}
test('expiry, wrong state, stale extension and amount conflict are surfaced without paid claims',async()=>{
 for(const code of ['P3003','P3004','P3005','P3006']){const{api}=route({data:null,error:{code}});const response=await api.POST(request(verifyBody));assert.equal(response.status,409);assert.equal((await response.json()).ok,false);}
});
test('extension is explicit and binds expected deadline plus audit reason',async()=>{
 const expires=new Date(Date.now()+600000).toISOString(),{api,db}=route({data:expires,error:null});
 const body={action:'extend',booking_id:booking,minutes:10,reason:'Customer needs more time',expected_expires_at:new Date().toISOString()};
 assert.equal((await api.POST(request(body))).status,200);assert.equal(db.calls[0].rpc,'admin_extend_bank_window');assert.equal(db.calls[0].args.p_reason,body.reason);assert.equal(db.calls[0].args.p_expected_expires_at,body.expected_expires_at);
});
const bank={bank_name:'Test bank only',bank_account_name:'Test only',sort_code:'000000',account_number:'00000000'};
test('pending manual payment never counts as paid; receipt requires verified actor and time',()=>{
 const api=loadSource('src/lib/booking-state.ts'),p={provider:'manual',payment_method:'bank_transfer',status:'pending',verified:false,paid_at:null,amount_pence:amount};
 assert.equal(api.hasRecordedDeposit({status:'AWAITING_BANK_PAYMENT',total_amount:amount,bank_payment:p}),false);
 assert.equal(api.hasRecordedDeposit({status:'CONFIRMED',total_amount:amount,bank_payment:{...p,status:'received'}}),false);
 assert.equal(api.hasRecordedDeposit({status:'CONFIRMED',total_amount:amount,bank_payment:{...p,status:'received',verified:true,paid_at:new Date().toISOString()}}),true);
});
test('phone booking shares the checkout transaction and never trusts browser booking source',async()=>{
 const data={booking_id:booking,reference:'GF-TEST-ONLY',manage_token:randomUUID(),status:'AWAITING_BANK_PAYMENT',expires_at:'2030-01-01T12:00:00Z',total_pence:amount,deposit_pence:amount,balance_pence:0};
 const db=databaseDouble(()=>{throw Error('Unexpected table write');},()=>({data:[data],error:null}));
 const api=loadSource('src/app/api/admin/bookings/phone/route.ts',{db,modules:{...authModules(),
 '@/lib/rateLimit':{checkRateLimit:async()=>({allowed:true}),getClientIp:()=> 'test'},'@/lib/postcodes':{resolvePostcode:async()=>({postcode:'E14 8PX'})}}});
 const payload={slot_id:randomUUID(),session_token:randomUUID(),items:[{tyre_id:randomUUID(),quantity:2}],customer:{name:'Test only',email:'test@example.invalid',phone:'+441632960001',address_line1:'Test only',postcode:'E14 8PX'},vehicle:{}};
 assert.equal((await api.POST(request({...payload,booking_source:'phone'}))).status,400);
 assert.equal((await api.POST(request(payload))).status,200);assert.equal(db.calls.length,1);assert.equal(db.calls[0].rpc,'admin_reserve_phone_booking');assert.equal(db.calls[0].args.p_actor_user_id,actor.user.id);
});
const env={RESEND_API_KEY:'test-only-key',EMAIL_FROM:'Test <payments@example.invalid>',NEXT_PUBLIC_SITE_URL:'https://example.invalid'};
function emailCase(response,options={}){
 const queued={id:randomUUID(),recipient:'test@example.invalid',deduplication_key:'test-only-key',status:options.sent?'sent':'processing',attempts:1,
 payload:{reference:'GF-TEST-ONLY',amount_pence:amount,bank_details:bank,expires_at:'2030-01-01T12:00:00Z',manage_token:randomUUID()}};
 const db=databaseDouble(()=>{throw Error('Unexpected table write');},name=> name==='admin_claim_bank_email'?{data:queued,error:null}:{data:options.finishError?null:true,error:options.finishError?{}:null});
 let calls=0;
 const api=loadSource('src/lib/bank-email.ts',{db,env:options.env??env,fetch:async(url,init)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert(init.signal);assert.equal(init.headers['Idempotency-Key'],queued.deduplication_key);const body=JSON.parse(init.body);assert.match(body.text,/Your booking is confirmed after G Force verifies receipt/);assert.doesNotMatch(body.text,/Deposit paid|Payment received/);if(response instanceof Error)throw response;return response;}});
 return{api,db,calls:()=>calls};
}
test('missing email configuration cannot be reported sent or create an outbox claim',async()=>{const{api,db,calls}=emailCase(null,{env:{}});await assert.rejects(api.emailBankInstructions(actor,booking));assert.equal(calls(),0);assert.equal(db.calls.length,0);});
for(const[label,response]of [['provider error',Response.json({message:'Rejected'},{status:500})],['malformed acknowledgement',Response.json({ok:true})],['timeout',Error('Timeout')]]){
 test('bank instructions '+label+' is recorded unconfirmed',async()=>{const{api,db}=emailCase(response);await assert.rejects(api.emailBankInstructions(actor,booking));assert.equal(db.calls.at(-1).args.p_message_id,null);});
}
test('bank instructions report acceptance only after provider id and persisted completion',async()=>{const id=randomUUID(),{api,db}=emailCase(Response.json({id}));assert.equal(await api.emailBankInstructions(actor,booking),'accepted');assert.equal(db.calls.at(-1).args.p_message_id,id);
 const broken=emailCase(Response.json({id}),{finishError:true});await assert.rejects(broken.api.emailBankInstructions(actor,booking));
});
test('already accepted bank instructions are never resent',async()=>{const{api,calls}=emailCase(null,{sent:true});assert.equal(await api.emailBankInstructions(actor,booking),'already_accepted');assert.equal(calls(),0);});

function rawBooking() {return { id:booking,booking_ref:'GF-TEST-ONLY',manage_token:randomUUID(),customer_id:null,slot_id:null,fitter_id:null,
 vehicle_reg:null,vehicle_make:null,vehicle_model:null,vehicle_derivative:null,fitting_address:'Test only',fitting_postcode:'E14 8PX',customer_notes:null,
 status:'AWAITING_BANK_PAYMENT',booking_source:'online',bank_payment_expires_at:'2030-01-01T12:00:00Z',tyres_total:24690,fitting_fee:1700,callout_charge:731,
 total_amount:amount,deposit_amount:amount,balance_due:0,created_at:'2026-10-10T12:00:00Z',updated_at:'2026-10-10T12:00:00Z',customer:null,slot:null,items:[],
 payments:[{provider:'manual',payment_method:'bank_transfer',type:'deposit',status:'pending',amount_pence:amount,currency:'gbp',reference:'GF-TEST-ONLY',bank_details:bank,
 paid_at:null,verified_by_admin_id:null,stripe_payment_intent_id:null,succeeded_at:null}]};}
test('canonical booking projection exposes bank snapshot without verifier identity or fabricated Stripe receipt',()=>{
 const api=loadSource('src/lib/canonical-booking.ts'),row=rawBooking(),mapped=api.mapBooking(row);
 assert.equal(mapped.bank_payment.amount_pence,amount);assert.deepEqual(mapped.bank_payment.bank_details,bank);assert.equal(mapped.bank_payment.verified,false);
 assert.equal(mapped.stripe_payment_intent_id,null);assert.equal(mapped.deposit_paid_at,null);assert.equal(mapped.bank_payment.verified_by_admin_id,undefined);
 row.status='CONFIRMED';Object.assign(row.payments[0],{status:'received',paid_at:'2026-10-10T12:00:00Z',verified_by_admin_id:actor.profile.id});assert.equal(api.mapBooking(row).bank_payment.verified,true);
});
test('missing/malformed bank instructions and unverifiable receipt fail closed; legacy unknown source stays unknown',()=>{
 const api=loadSource('src/lib/canonical-booking.ts');
 for(const patch of [{bank_details:{}},{amount_pence:1},{status:'received',paid_at:null},{status:'received',paid_at:'2026-10-10T12:00:00Z',verified_by_admin_id:null}]){const row=rawBooking();Object.assign(row.payments[0],patch);assert.throws(()=>api.mapBooking(row),/unavailable/);}
 const old=rawBooking();old.payments=[];old.booking_source=null;old.status='pending_payment';old.bank_payment_expires_at=null;
 assert.equal(api.mapBooking(old).booking_source,null);assert.equal(api.mapBooking(old).bank_payment,null);
});
test('only owner can save validated bank settings; supplied text preserves leading zeroes',async()=>{
 const db=databaseDouble(()=>({data:{...bank,bank_payment_window_minutes:60},error:null}),()=>({data:null,error:null}));
 const owner=loadSource('src/app/api/admin/bank-settings/route.ts',{db,modules:authModules({role:'owner'})});
 const body={...bank,bank_payment_window_minutes:60};assert.equal((await owner.PUT(new Request('https://test.invalid/api/admin/bank-settings',{method:'PUT',body:JSON.stringify(body)}))).status,200);
 const call=db.calls.find(c=>c.rpc);assert.equal(call.rpc,'owner_set_bank_settings');assert.equal(call.args.p_sort_code,'000000');assert.equal(call.args.p_account_number,'00000000');assert.equal(call.args.p_actor_user_id,actor.user.id);
 const admin=loadSource('src/app/api/admin/bank-settings/route.ts',{db,modules:authModules()});assert.equal((await admin.PUT(new Request('https://test.invalid/api/admin/bank-settings',{method:'PUT',body:JSON.stringify(body)}))).status,403);
});
