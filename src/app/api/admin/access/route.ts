import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminErrorResponse, requireAdmin, requireSameOrigin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const changeSchema = z.object({ user_id: z.string().uuid(), role: z.enum(['owner', 'admin', 'viewer']), active: z.boolean() }).strict();

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
