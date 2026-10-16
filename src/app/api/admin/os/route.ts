import { NextResponse } from 'next/server';
import { adminErrorResponse, requireAdmin, requireSameOrigin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminActionSchema } from '@/lib/admin-os';

export const runtime='nodejs';
const resources=new Set(['dashboard','bookings','products','inventory','slots','zones','fitters','customers','payments','settings','audit']);
const noStore={headers:{'Cache-Control':'no-store'}};

export async function GET(request:Request){
  try{
    const actor=await requireAdmin('read'); const resource=new URL(request.url).searchParams.get('resource')??'';
    if(!resources.has(resource)) return NextResponse.json({ok:false,error:'invalid_resource'},{status:400});
    if(resource==='settings'&&actor.profile.role!=='owner') return NextResponse.json({ok:false,error:'forbidden'},{status:403});
    const db=createAdminClient(); let data:unknown;
    if(resource==='dashboard'){
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const [bookings,payments,inventory,slots,emails,inventoryHolds,slotHolds,settings,zones,fitters,rules,products]=await Promise.all([
        db.from('bookings').select('id,status,total_pence,fitter_id,slot_id,bank_payment_expires_at,slot:booking_slots(date,capacity)'),
        db.from('payments').select('status,amount_pence,booking_id').eq('provider','manual'),
        db.from('inventory').select('tyre_product_id,stock_qty,reserved_qty,low_stock_threshold'),
        db.from('booking_slots').select('id,date,capacity').gte('date',today).limit(500),
        db.from('email_outbox').select('id',{count:'exact',head:true}).eq('status','failed'),
        db.from('inventory_holds').select('tyre_product_id,quantity,expires_at').gt('expires_at',new Date().toISOString()),
        db.from('slot_holds').select('slot_id,expires_at').gt('expires_at',new Date().toISOString()),
        db.from('business_settings').select('phone,email,whatsapp,bank_account_name,bank_name,sort_code,account_number,bank_payment_window_minutes,fitting_fee_pence,job_duration_minutes,cancellation_policy,terms_and_conditions,privacy_policy,pricing_configured').eq('id',1).single(),
        db.from('service_zones').select('id,active,callout_fee_pence').eq('active',true),
        db.from('fitters').select('id,active').eq('active',true),
        db.from('availability_rules').select('id,active').eq('active',true),
        db.from('tyre_products').select('id,active').eq('active',true),
      ]);
      if(bookings.error||payments.error||inventory.error||slots.error||emails.error||inventoryHolds.error||slotHolds.error||settings.error) throw new Error();
      const rows=((bookings.data??[]) as unknown as Array<{id:string,status:string,total_pence:number,fitter_id:string|null,slot_id:string|null,slot:Array<{date:string;capacity:number}>}>).map(b=>({...b,slot:b.slot?.[0]??null}));
      const pay=payments.data??[], active=new Set(['CONFIRMED','tyres_reserved','fitter_assigned','en_route']);
      const s = settings.data ?? {} as Record<string, unknown>;
      const activeProds = products.data ?? [];
      const stockItems = (inventory.data ?? []).filter(i => i.stock_qty > 0);
      const activeZones = zones.data ?? [];
      const activeFitters = fitters.data ?? [];
      const activeRules = rules.data ?? [];
      const futureSlots = slots.data ?? [];
      const hasEmailConfig = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
      const bankConfigured = Boolean(s.bank_account_name && s.bank_name && s.sort_code && s.account_number && s.bank_payment_window_minutes);
      const policiesConfigured = Boolean(s.cancellation_policy && s.terms_and_conditions && s.privacy_policy);
      const pricingConfigured = Boolean(s.pricing_configured && s.fitting_fee_pence != null && s.job_duration_minutes);

      data={
        today_jobs:rows.filter(b=>b.slot?.date===today&&!['cancelled','refunded','EXPIRED'].includes(b.status)).length,
        awaiting_bank_payment:rows.filter(b=>b.status==='AWAITING_BANK_PAYMENT').length,confirmed:rows.filter(b=>b.status==='CONFIRMED').length,
        upcoming:rows.filter(b=>b.slot?.date>=today&&active.has(b.status)).length,completed:rows.filter(b=>b.status==='completed').length,
        cancelled:rows.filter(b=>b.status==='cancelled').length,revenue_received:pay.filter(p=>p.status==='received').reduce((n,p)=>n+p.amount_pence,0),
        outstanding_balances:pay.filter(p=>p.status==='pending'&&rows.some(b=>b.id===p.booking_id&&b.status==='AWAITING_BANK_PAYMENT')).reduce((n,p)=>n+p.amount_pence,0),
        low_stock:(inventory.data??[]).filter(i=>i.stock_qty-i.reserved_qty-(inventoryHolds.data??[]).filter(h=>h.tyre_product_id===i.tyre_product_id).reduce((n,h)=>n+h.quantity,0)<=i.low_stock_threshold).length,
        capacity:(slots.data??[]).reduce((n,slot)=>n+Math.max(0,slot.capacity-rows.filter(b=>b.slot_id===slot.id&&active.has(b.status)).length-(slotHolds.data??[]).filter(h=>h.slot_id===slot.id).length),0),unassigned_jobs:rows.filter(b=>active.has(b.status)&&!b.fitter_id).length,
        failed_emails:emails.count??0,
        pricing_configured: Boolean(s.pricing_configured),
        checklist: [
          { id: 'contacts', title: 'Contacts and public contact links', ready: Boolean(s.phone && s.email), evidence: s.phone ? `Phone: ${s.phone}, Email: ${s.email || 'None'}` : 'No phone registered', link: '/admin/settings' },
          { id: 'products', title: 'Approved products and stock', ready: activeProds.length > 0 && stockItems.length > 0, evidence: `${activeProds.length} active products, ${stockItems.length} lines with stock`, link: '/admin/inventory' },
          { id: 'zones', title: 'Service coverage and callout fees', ready: activeZones.length > 0, evidence: `${activeZones.length} active service zones`, link: '/admin/zones' },
          { id: 'fitters', title: 'Real fitters', ready: activeFitters.length > 0, evidence: `${activeFitters.length} active fitters`, link: '/admin/fitters' },
          { id: 'slots', title: 'Weekly hours and generated slots', ready: activeRules.length > 0 && futureSlots.length > 0, evidence: `${activeRules.length} weekly rules, ${futureSlots.length} future slots`, link: '/admin/slots' },
          { id: 'pricing', title: 'Pricing and VAT', ready: pricingConfigured, evidence: `Fitting: £${((Number(s.fitting_fee_pence)||0)/100).toFixed(2)}, Duration: ${s.job_duration_minutes||'—'}m, Approved: ${s.pricing_configured?'Yes':'No'}`, link: '/admin/settings' },
          { id: 'bank', title: 'Business bank account and payment window', ready: bankConfigured, evidence: s.account_number ? `Sort: ${String(s.sort_code).replace(/(\d{2})(\d{2})(\d{2})/,'$1-$2-$3')}, Window: ${s.bank_payment_window_minutes}m` : 'Bank details missing', link: '/admin/settings' },
          { id: 'policies', title: 'Approved legal policies', ready: policiesConfigured, evidence: s.cancellation_policy ? 'Cancellation, Terms & Privacy recorded' : 'Policies missing', link: '/admin/settings' },
          { id: 'email', title: 'Email delivery', ready: hasEmailConfig && (emails.count??0) === 0, evidence: hasEmailConfig ? `Resend API configured (0 outbox failures)` : 'API credentials not detected', link: '/admin/settings' },
          { id: 'live_acceptance', title: 'Live booking acceptance', ready: Boolean(s.pricing_configured), evidence: s.pricing_configured ? 'Checkout active and accepting customer orders' : 'Checkout blocked pending owner pricing approval', link: '/admin/settings' },
        ],
      };
    }else if(resource==='bookings'){
      const [bookings,fitters,slots]=await Promise.all([
        db.from('bookings').select('id,reference,status,booking_source,registration,fitting_address,postcode,total_pence,bank_payment_expires_at,fitter_id,slot_id,created_at,customer:customers(first_name,last_name,email,phone),slot:booking_slots(date,start_at,end_at),payment:payments!payments_booking_id_fkey(provider,status,amount_pence)').order('created_at',{ascending:false}).limit(500),
        db.from('fitters').select('id,name,phone,van_name,active').eq('active',true).order('name'),
        db.from('booking_slots').select('id,date,start_at,end_at,capacity,active').eq('active',true).gte('date',new Date().toISOString().slice(0,10)).order('date').order('start_at').limit(500)]);
      if(bookings.error||fitters.error||slots.error)throw new Error(); data={bookings:bookings.data,fitters:fitters.data,slots:slots.data};
    }else if(resource==='products'||resource==='inventory'){
      const q=await db.from('tyre_products').select('id,sku,brand,model,width,profile,rim,load_index,speed_rating,run_flat,extra_load,season,tier,image_url,active,inventory(id,stock_qty,reserved_qty,cost_price_pence,selling_price_pence,supplier_sku,low_stock_threshold,updated_at)').order('brand').order('model');
      if(q.error)throw new Error(); data=q.data;
    }else if(resource==='slots'){
      const [rules,blocked,special,slots,settings]=await Promise.all([db.from('availability_rules').select('*').order('day_of_week'),db.from('blocked_dates').select('*').order('date'),
        db.from('special_dates').select('*').order('date'),db.from('booking_slots').select('*').gte('date',new Date().toISOString().slice(0,10)).order('date').order('start_at').limit(500),
        db.from('business_settings').select('booking_horizon_days').eq('id',1).single()]);
      if(rules.error||blocked.error||special.error||slots.error||settings.error)throw new Error(); data={rules:rules.data,blocked:blocked.data,special:special.data,slots:slots.data,settings:settings.data};
    }else if(resource==='zones'){
      const q=await db.from('service_zones').select('*').order('priority').order('postcode_prefix');if(q.error)throw new Error();data=q.data;
    }else if(resource==='fitters'){
      const [f,b]=await Promise.all([db.from('fitters').select('*').order('name'),db.from('bookings').select('fitter_id,status').not('status','in','(completed,cancelled,refunded,EXPIRED)')]);
      if(f.error||b.error)throw new Error();data=(f.data??[]).map(x=>({...x,workload:(b.data??[]).filter(v=>v.fitter_id===x.id).length}));
    }else if(resource==='customers'){
      const q=await db.from('customers').select('id,first_name,last_name,email,phone,created_at,bookings(id,reference,status,total_pence,registration,created_at,payments(status,amount_pence,paid_at,refunded_at,refund_amount_pence))').order('created_at',{ascending:false}).limit(500);if(q.error)throw new Error();data=q.data;
    }else if(resource==='payments'){
      const q=await db.from('payments').select('id,booking_id,provider,payment_method,status,amount_pence,currency,reference,paid_at,refunded_at,refund_amount_pence,refund_reference,created_at,updated_at,booking:bookings(reference,status,bank_payment_expires_at)').eq('provider','manual').order('created_at',{ascending:false}).limit(500);if(q.error)throw new Error();data=q.data;
    }else if(resource==='settings'){
      const q=await db.from('business_settings').select('phone,email,whatsapp,bank_account_name,bank_name,sort_code,account_number,bank_payment_window_minutes,fitting_fee_pence,job_duration_minutes,booking_horizon_days,same_day_enabled,same_day_cutoff,vat_registered,vat_number,vat_rate_bps,cancellation_notice_hours,cancellation_policy,terms_and_conditions,privacy_policy,pricing_configured').eq('id',1).single();if(q.error)throw new Error();data=q.data;
    }else{
      const [q,p]=await Promise.all([db.from('audit_logs').select('id,admin_user_id,action,resource_type,resource_id,before_state,after_state,metadata,created_at').order('created_at',{ascending:false}).limit(500),db.from('admin_profiles').select('user_id,name')]);
      if(q.error||p.error)throw new Error();const names=new Map((p.data??[]).map(x=>[x.user_id,x.name]));data=(q.data??[]).map(x=>({...x,actor_name:x.admin_user_id?names.get(x.admin_user_id)??null:null}));
    }
    return NextResponse.json({ok:true,data,role:actor.profile.role},noStore);
  }catch(error){return adminErrorResponse(error);}
}

export async function POST(request:Request){
  try{
    requireSameOrigin(request);const actor=await requireAdmin('operate');const parsed=adminActionSchema.safeParse(await request.json().catch(()=>null));
    if(!parsed.success)return NextResponse.json({ok:false,error:'invalid_request',issues:parsed.error.issues.map(i=>({path:i.path,message:i.message}))},{status:400});
    const {data,error}=await createAdminClient().rpc('admin_os_mutate',{p_actor_user_id:actor.user.id,p_session_id:actor.sessionId,p_action:parsed.data.action,p_payload:parsed.data.payload});
    if(error)return NextResponse.json({ok:false,error:'change_rejected',message:error.code==='42501'?'Access denied.':'The change was not applied. Refresh current data and check capacity, stock and status.'},{status:error.code==='42501'?403:['23514','23505','P0002','22023','22P02','55000'].includes(error.code)?409:503});
    return NextResponse.json({ok:true,data},noStore);
  }catch(error){return adminErrorResponse(error);}
}
