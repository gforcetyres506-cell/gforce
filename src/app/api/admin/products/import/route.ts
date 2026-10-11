import {NextResponse} from 'next/server';
import {adminErrorResponse,requireAdmin,requireSameOrigin} from '@/lib/auth/admin';
import {createAdminClient} from '@/lib/supabase/admin';
import {parseCsv,productImportRowSchema} from '@/lib/admin-os';
export const runtime='nodejs';
const columns=['sku','brand','model','width','profile','rim','load_index','speed_rating','run_flat','extra_load','season','tier','image_url','stock_qty','cost_price_pence','selling_price_pence','supplier_sku','low_stock_threshold'];
export async function POST(request:Request){
  try{requireSameOrigin(request);const actor=await requireAdmin('operate');const text=await request.text();
    if(new TextEncoder().encode(text).length>1000000)return NextResponse.json({ok:false,error:'too_large'},{status:413});
    let raw:string[][];try{raw=parseCsv(text);}catch{return NextResponse.json({ok:false,error:'invalid_csv'},{status:400});}
    if(raw.length<2||raw.length>501||raw[0].map(v=>v.trim()).join(',')!==columns.join(','))return NextResponse.json({ok:false,error:'invalid_headers',expected:columns},{status:400});
    const rows=raw.slice(1).map(r=>Object.fromEntries(columns.map((k,i)=>[k,['width','profile','rim','stock_qty','cost_price_pence','selling_price_pence','low_stock_threshold'].includes(k)?Number(r[i]):['run_flat','extra_load'].includes(k)?r[i]?.trim().toLowerCase()==='true':r[i]?.trim()??''])));
    const parsed=productImportRowSchema.array().min(1).max(500).safeParse(rows);if(!parsed.success)return NextResponse.json({ok:false,error:'invalid_rows',issues:parsed.error.issues.map(i=>({path:i.path,message:i.message}))},{status:400});
    const {data,error}=await createAdminClient().rpc('admin_os_import_products',{p_actor_user_id:actor.user.id,p_session_id:actor.sessionId,p_rows:parsed.data});
    if(error||data!==parsed.data.length)return NextResponse.json({ok:false,error:'import_rejected',message:'No partial import was accepted.'},{status:error?.code==='42501'?403:409});
    return NextResponse.json({ok:true,data:{saved:data}});
  }catch(error){return adminErrorResponse(error);}
}
