import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource, databaseDouble } from './loader.mjs';

test('quote rejects a nonexistent postcode before catalogue pricing', async () => {
  const calls=[];
  const route=loadSource('src/app/api/checkout/quote/route.ts',{modules:{
    '@/lib/postcodes':{resolvePostcode:async()=>null,checkCoverage:async()=>{calls.push('coverage');throw Error();}},
    '@/lib/pricing':{calculatePrice:async()=>{calls.push('pricing');throw Error();},PricingError:class extends Error{}},
  }});
  const response=await route.POST(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({
    postcode:'E14 8PX',items:[{tyre_id:'00000000-0000-4000-8000-000000000001',quantity:1}],
  })}));
  assert.equal(response.status,400); assert.deepEqual(calls,[]);
});
test('a lost import response cannot claim success or guaranteed rollback',async()=>{
  const route=loadSource('src/app/api/admin/data/route.ts',{modules:{
    '@/lib/auth/admin':{requireAdmin:async()=>({user:{id:'test-owner'},sessionId:'test-session'}),requireSameOrigin:()=>{},adminErrorResponse:()=>Response.json({ok:false},{status:503})},
    '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async()=>({data:null,error:{code:'network_failure'}})})},
  }});
  const response=await route.POST(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({
    kind:'zones',rows:[{postcode_prefix:'E1',name:'Test only',callout_fee_pence:0,priority:1,active:true}],
  })}));
  const body=await response.json(); assert.equal(response.status,503); assert.equal(body.ok,false);
  assert.match(body.message,/could not be confirmed/); assert.doesNotMatch(body.message,/No records.*saved/);
});
test('public catalogue maps supplied product fields, images, filters and net stock without private prices',async()=>{
  const product={id:'test-only',sku:'TEST',brand:'Test only',model:'API fixture',width:205,profile:55,rim:16,
    load_index:'91',speed_rating:'V',run_flat:false,extra_load:true,season:'summer',tier:'standard',
    wet_grip_rating:'A',fuel_efficiency_rating:'B',noise_db:70,image_url:'https://example.invalid/test.png',
    active:true,created_at:'2030-01-01',inventory_holds:[],inventory:{stock_qty:7,reserved_qty:2,selling_price_pence:6543,cost_price_pence:3210,supplier_sku:'PRIVATE'}};
  const db=databaseDouble(()=>({data:[product],error:null}));
  const route=loadSource('src/app/api/tyres/route.ts',{db});
  const response=await route.GET(new Request('https://example.invalid/api/tyres?w=205&p=55&r=16&tier=standard'));
  const [row]=(await response.json()).data;
  assert.equal(row.stock,5);assert.equal(row.sell_price,6543);assert.equal(row.image_url,product.image_url);
  assert.equal(row.fuel_economy,'B');assert.equal(row.is_xl,true);assert(!('cost_price_pence' in row));assert(!('supplier_sku' in row));
  for(const [field,value] of [['width',205],['profile',55],['rim',16],['tier','standard']]){
    assert(db.calls[0].filters.some((f)=>f[0]==='eq'&&f[1]===field&&f[2]===value));
  }
});
