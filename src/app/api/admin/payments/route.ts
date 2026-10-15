import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminErrorResponse, requireAdmin, requireSameOrigin } from '@/lib/auth/admin';
import { createServiceClient } from '@/lib/supabase';
const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('verify'), booking_id: z.string().uuid(), expected_amount_pence: z.number().int().positive(), bank_receipt_confirmed: z.literal(true) }).strict(),
  z.object({ action: z.literal('extend'), booking_id: z.string().uuid(), minutes: z.number().int().min(1).max(10080), reason: z.string().trim().min(3).max(500), expected_expires_at: z.string().datetime({ offset: true }) }).strict(),
]);
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const actor = await requireAdmin();
    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
    const v = input.data, common = { p_actor_user_id: actor.user.id, p_session_id: actor.sessionId, p_booking_id: v.booking_id };
    const { data, error } = v.action === 'verify'
      ? await createServiceClient().rpc('admin_verify_bank_payment', { ...common, p_expected_amount_pence: v.expected_amount_pence })
      : await createServiceClient().rpc('admin_extend_bank_window', { ...common, p_minutes: v.minutes, p_reason: v.reason, p_expected_expires_at: v.expected_expires_at });
    if (error) return NextResponse.json({ ok: false, error: error.code === '42501' ? 'forbidden' : 'payment_not_changed',
      message: 'The change could not be confirmed. Refresh the booking. Expired reservations must have their resources checked before extension.' },
    { status: error.code === '42501' ? 403 : /^P[23]/.test(error.code) ? 409 : 503 });
    const validResult = v.action === 'verify'
      ? z.object({ booking_id: z.literal(v.booking_id), status: z.literal('received'), provider: z.literal('manual'),
          amount_pence: z.literal(v.expected_amount_pence), paid_at: z.string().datetime({ offset: true }), verified_by_admin_id: z.string().uuid() }).safeParse(Array.isArray(data) ? data[0] : data).success
      : z.string().datetime({ offset: true }).safeParse(data).success && Date.parse(data) > Date.now();
    if (!validResult) return NextResponse.json({ ok: false, error: 'unverified_response' }, { status: 503 });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return adminErrorResponse(error); }
}
