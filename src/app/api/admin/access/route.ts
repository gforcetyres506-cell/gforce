import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminErrorResponse, requireAdmin, requireSameOrigin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const changeSchema = z.object({ user_id: z.string().uuid(), role: z.enum(['owner', 'admin', 'viewer']), active: z.boolean() }).strict();

export async function GET() {
  try {
    await requireAdmin('owner');
    const db=createAdminClient();
    const [profiles,users]=await Promise.all([db.from('admin_profiles').select('id,user_id,name,role,active,created_at,updated_at').order('created_at'),db.auth.admin.listUsers({page:1,perPage:1000})]);
    if(profiles.error||users.error)throw new Error();
    const emails=new Map(users.data.users.map(u=>[u.id,u.email??null]));
    return NextResponse.json({ok:true,data:(profiles.data??[]).map(p=>({...p,email:emails.get(p.user_id)??null}))},{headers:{'Cache-Control':'no-store'}});
  } catch(error){return adminErrorResponse(error);}
}

const provisionSchema=z.object({email:z.string().trim().email().max(254),name:z.string().trim().min(1).max(120),role:z.enum(['owner','admin','viewer'])}).strict();
export async function POST(request:Request){
  try{
    requireSameOrigin(request);const actor=await requireAdmin('owner');const parsed=provisionSchema.safeParse(await request.json().catch(()=>null));
    if(!parsed.success)return NextResponse.json({ok:false,error:'invalid_request'},{status:400});
    const db=createAdminClient();const invited=await db.auth.admin.inviteUserByEmail(parsed.data.email,{data:{name:parsed.data.name}});
    if(invited.error||!invited.data.user)return NextResponse.json({ok:false,error:'invite_rejected',message:'The admin invitation was not sent.'},{status:409});
    const saved=await db.rpc('owner_provision_admin',{p_actor_user_id:actor.user.id,p_session_id:actor.sessionId,p_target_user_id:invited.data.user.id,p_name:parsed.data.name,p_role:parsed.data.role});
    if(saved.error){await db.auth.admin.deleteUser(invited.data.user.id);return NextResponse.json({ok:false,error:'provision_rejected',message:'Access was not provisioned; the incomplete invitation was removed.'},{status:saved.error.code==='42501'?403:409});}
    return NextResponse.json({ok:true,data:{user_id:invited.data.user.id,role:parsed.data.role,active:true}});
  }catch(error){return adminErrorResponse(error);}
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdmin('owner');
    requireSameOrigin(request);
    const parsed = changeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
    const { data, error } = await createAdminClient().rpc('owner_set_admin_access', {
      p_actor_user_id: actor.user.id, p_session_id: actor.sessionId,
      p_target_user_id: parsed.data.user_id, p_role: parsed.data.role, p_active: parsed.data.active,
    });
    if (error || !data) return NextResponse.json({ ok: false, error: 'change_rejected' }, { status: error?.code === '42501' ? 403 : error?.code === '23514' ? 409 : 503 });
    return NextResponse.json({ ok: true, data: { user_id: data.user_id, role: data.role, active: data.active } });
  } catch (error) { return adminErrorResponse(error); }
}
