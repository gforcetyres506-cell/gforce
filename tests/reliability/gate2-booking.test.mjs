import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { loadSource, databaseDouble } from './loader.mjs';

const payload=()=>({slot_id:randomUUID(),session_token:randomUUID(),customer:{name:'Test Only',email:'test@example.invalid',phone:'+441632960001',address_line1:'Test fixture',postcode:'E14 8PX'},vehicle:{},items:[{tyre_id:randomUUID(),quantity:2}]});
const request=(body,origin)=>new Request('https://example.invalid/api/checkout/create',{method:'POST',headers:origin?{origin}:{},body:JSON.stringify(body)});
function route(result, overrides={}) {
 const calls=[];
 const db=databaseDouble(()=>{throw Error('No multi-step database writes permitted');},async(name,args)=>{calls.push({name,args});return result;});
 const api=loadSource('src/app/api/checkout/create/route.ts',{db,modules:{
  '@/lib/rateLimit':{getClientIp:()=> 'test-only',checkRateLimit:async()=>({allowed:true,remaining:29})},
  '@/lib/postcodes':{resolvePostcode:async()=>({postcode:'E14 8PX',outcode:'E14'})},
  ...overrides,
 }});
 return {api,calls};
}
for(const injected of [{price:1},{stock:99},{capacity:9},{payment_state:'paid'}]){
 test('checkout rejects browser business truth '+Object.keys(injected)[0],async()=>{
  const {api,calls}=route({data:null,error:null});
  const res=await api.POST(request({...payload(),...injected}));assert.equal(res.status,400);assert.equal(calls.length,0);
 });
}
test('checkout binds only validated intent to one authoritative transaction',async()=>{
 const data={booking_id:randomUUID(),reference:'TEST-ONLY',manage_token:randomUUID(),status:'AWAITING_BANK_PAYMENT',expires_at:'2030-01-01T12:00:00+00:00',total_pence:27121,deposit_pence:6780,balance_pence:20341};
 const {api,calls}=route({data:[data],error:null});const body=payload(),res=await api.POST(request(body));
 assert.equal(res.status,200);assert.deepEqual((await res.json()).data,data);assert.equal(calls.length,1);
 assert.equal(calls[0].name,'reserve_booking_checkout');assert.equal(calls[0].args.p_checkout_key,body.session_token);
 assert.equal(calls[0].args.p_slot_id,body.slot_id);assert.deepEqual(calls[0].args.p_items,body.items);
 assert.equal(res.headers.get('Cache-Control'),'no-store');
});
for(const [code,status,message] of [['P2002',409,/could not be reserved/],['P2003',409,/quantity is no longer available/],['P2004',503,/Pricing unavailable/],['P2005',409,/already has a reservation/]]){
 test('checkout maps confirmed database rejection '+code,async()=>{
  const {api}=route({data:null,error:{code}});const res=await api.POST(request(payload()));assert.equal(res.status,status);assert.match((await res.json()).message,message);
 });
}
for(const data of [null,[],[{status:'confirmed'}],[{status:'AWAITING_BANK_PAYMENT',manage_token:'invalid'}]]){
 test('unknown or malformed reservation result never claims success '+JSON.stringify(data),async()=>{
  const {api}=route({data,error:null});const res=await api.POST(request(payload()));const body=await res.json();
  assert.equal(res.status,503);assert.equal(body.ok,false);assert.match(body.message,/Retry this checkout/);assert.doesNotMatch(body.message,/No booking.*created/);
 });
}
test('cross-site checkout rejected before database access',async()=>{
 const {api,calls}=route({data:null,error:null});assert.equal((await api.POST(request(payload(),'https://other.invalid'))).status,403);assert.equal(calls.length,0);
});
test('invalid postcode and rate limiter failure cannot reach booking RPC',async()=>{
 for(const modules of [
  {'@/lib/postcodes':{resolvePostcode:async()=>null}},
  {'@/lib/rateLimit':{getClientIp:()=> 'test',checkRateLimit:async()=>{throw Error('Database down');}}},
 ]){
  const {api,calls}=route({data:null,error:null},modules);assert.notEqual((await api.POST(request(payload()))).status,200);assert.equal(calls.length,0);
 }
});
test('legacy release can never delete a committed bank hold',async()=>{
 const db=databaseDouble(()=>({data:[],error:null}));const api=loadSource('src/lib/db.ts',{db});assert.equal(await api.releaseSlotHold('test-only'),false);
 assert(db.calls[0].filters.some(f=>f[0]==='is'&&f[1]==='booking_id'&&f[2]===null));
});
test('catalogue subtracts live temporary holds and ignores expired holds',async()=>{
 const product={id:'test-only',sku:'TEST',brand:'Test only',model:'Fixture',width:205,profile:55,rim:16,load_index:null,speed_rating:null,run_flat:false,extra_load:false,season:'summer',tier:'standard',wet_grip_rating:null,fuel_efficiency_rating:null,noise_db:null,image_url:null,active:true,created_at:'2030-01-01',inventory:{stock_qty:6,reserved_qty:1,selling_price_pence:12345},inventory_holds:[{quantity:2,expires_at:'2099-01-01T00:00:00Z'},{quantity:3,expires_at:'2000-01-01T00:00:00Z'}]};
 const api=loadSource('src/lib/canonical-data.ts');assert.equal(api.mapProducts([product])[0].stock,3);
});
test('bank payment statuses never become payment confirmation',()=>{
 const api=loadSource('src/lib/booking-state.ts');
 assert.equal(api.bookingHeading({status:'AWAITING_BANK_PAYMENT'}),'Awaiting bank payment');assert.equal(api.bookingHeading({status:'EXPIRED'}),'Booking expired');
});
