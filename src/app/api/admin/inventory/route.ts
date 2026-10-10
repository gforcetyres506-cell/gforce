import { NextResponse } from 'next/server';
import { adminErrorResponse, requireAdmin, requireSameOrigin } from '@/lib/auth/admin';
import { getAllTyresAdmin } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

export const runtime = 'nodejs';
export async function GET() {
  try { await requireAdmin('read'); } catch (error) { return adminErrorResponse(error); }
  try {
    return NextResponse.json({ ok: true, data: await getAllTyresAdmin() });
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: 'Inventory unavailable.' }, { status: 503 });
  }
}
async function unavailable() {
  try { await requireAdmin(); } catch (error) { return adminErrorResponse(error); }
  return NextResponse.json({ ok: false, error: 'service_unavailable',
    message: 'Inventory changes are unavailable until persistent admin workflows are verified. No change has been made.',
  }, { status: 503 });
}
export const POST = unavailable;
const changeSchema = z.object({
  tyre_product_id: z.string().uuid(), stock_qty: z.number().int().nonnegative().max(2147483647).optional(),
  selling_price_pence: z.number().int().positive().max(2147483647).optional(),
}).strict().refine((v) => v.stock_qty !== undefined || v.selling_price_pence !== undefined);

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdmin();
    requireSameOrigin(request);
    const parsed = changeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
    const { data, error } = await createAdminClient().rpc('admin_set_inventory', {
      p_actor_user_id: actor.user.id, p_session_id: actor.sessionId,
      p_tyre_product_id: parsed.data.tyre_product_id,
      p_stock_qty: parsed.data.stock_qty ?? null, p_selling_price_pence: parsed.data.selling_price_pence ?? null,
    });
    if (error || !data) return NextResponse.json({ ok: false, error: 'change_rejected' },
      { status: error?.code === '42501' ? 403 : error?.code === '23514' ? 409 : 503 });
    return NextResponse.json({ ok: true, data: { tyre_product_id: data.tyre_product_id,
      stock_qty: data.stock_qty, reserved_qty: data.reserved_qty, selling_price_pence: data.selling_price_pence } });
  } catch (error) { return adminErrorResponse(error); }
}
