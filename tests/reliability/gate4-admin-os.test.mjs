import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {test} from 'node:test';
import {loadSource} from './loader.mjs';

const read=p=>readFileSync(p,'utf8');
const routes=['','bookings','products','inventory','slots','zones','fitters','customers','payments','settings','audit','access'];
test('all required owner operating routes exist and remain behind the protected layout',()=>{
 for(const route of routes)assert(existsSync(`src/app/admin/(protected)/${route?route+'/':''}page.tsx`),route||'/admin');
 assert.match(read('src/app/admin/(protected)/layout.tsx'),/requireAdminPage/);
});
test('navigation exposes every private operating route without adding public admin links',()=>{
 const nav=read('src/components/admin/AdminNav.tsx');for(const route of routes.filter(Boolean))assert.match(nav,new RegExp(`/admin/${route}`));
 assert.match(nav,/flex min-h-11 items-center/);
 const publicNav=read('src/components/layout/Header.tsx');assert.doesNotMatch(publicNav,/\/admin|Staff|Operator/i);
});
test('browser mutations use protected server APIs and no service credential',()=>{
 const ui=read('src/components/admin/AdminWorkspace.tsx')+read('src/components/admin/AccessManager.tsx');
 assert.match(ui,/\/api\/admin\/os/);assert.match(ui,/\/api\/admin\/access/);assert.doesNotMatch(ui,/SUPABASE_SERVICE_ROLE_KEY|createAdminClient/);
 const route=read('src/app/api/admin/os/route.ts');assert.match(route,/requireAdmin\('operate'\)/);assert.match(route,/requireSameOrigin/);assert.match(route,/admin_os_mutate/);
});
test('dangerous booking, payment, slot and archive actions route through confirmation UI',()=>{
 const ui=read('src/components/admin/AdminWorkspace.tsx');for(const action of ['booking.reschedule','booking.cancel','payment.refund','product.archive','slot.block','slot.capacity'])assert.match(ui,new RegExp(`confirm\\([^\\n]+${action.replace('.','\\.')}`));
 assert.match(ui,/<dialog/);assert.match(ui,/Have you confirmed/);assert.match(ui,/refund_confirmed:true/);
});
test('server validation covers product, inventory, zones, fitters, slots, settings and bookings',()=>{
 const {adminActionSchema}=loadSource('src/lib/admin-os.ts');
 const valid=[
  {action:'product.archive',payload:{id:'11111111-1111-4111-8111-111111111111'}},
  {action:'inventory.cycle_count',payload:{tyre_product_id:'11111111-1111-4111-8111-111111111111',stock_qty:4,reason:'Physical count'}},
  {action:'zone.save',payload:{name:'Test',postcode_prefix:'E14',callout_fee_pence:0,priority:1,active:true}},
  {action:'fitter.save',payload:{name:'Test',phone:'',van_name:'',active:true}},
  {action:'slot.generate',payload:{from_date:'2030-01-01',to_date:'2030-01-07'}},
  {action:'booking.cancel',payload:{booking_id:'11111111-1111-4111-8111-111111111111',reason:'Owner confirmed'}},
  {action:'payment.refund',payload:{booking_id:'11111111-1111-4111-8111-111111111111',reason:'Refund complete',refund_amount_pence:1000,refund_reference:'BANK-1',refund_confirmed:true}},
 ];for(const value of valid)assert.equal(adminActionSchema.safeParse(value).success,true,JSON.stringify(value));
 assert.equal(adminActionSchema.safeParse({action:'payment.refund',payload:{booking_id:'11111111-1111-4111-8111-111111111111',reason:'Refund',refund_confirmed:false}}).success,false);
});
test('SQL has immutable before/after audit and service-only operations',()=>{
 const sql=read('supabase/migrations/018_gate4_admin_operating_system.sql');
 assert.match(sql,/add column before_state jsonb/);assert.match(sql,/add column after_state jsonb/);assert.match(sql,/audit_logs_immutable/);assert.match(sql,/audit_logs_complete/);
 assert.match(sql,/payments_manual_refund_details_check/);assert.match(sql,/refunded_by_admin_id/);
 assert.match(sql,/revoke all on function[\s\S]+admin_os_mutate[\s\S]+from public,anon,authenticated/);
 assert.match(sql,/Owner cannot lock out their current account/);
});
