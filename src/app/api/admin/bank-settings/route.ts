import { NextResponse } from 'next/server';
import { adminErrorResponse, requireAdmin, requireSameOrigin } from '@/lib/auth/admin';
import { createServiceClient } from '@/lib/supabase';
import { bankSettingsSchema } from '@/lib/bank-payments';
export const runtime = 'nodejs';
export async function GET() {
  try {
    await requireAdmin('owner');
    const { data, error } = await createServiceClient().from('business_settings')
      .select('bank_account_name,bank_name,sort_code,account_number,bank_payment_window_minutes').eq('id', 1).single();
    if (error || !data) throw new Error();
    return NextResponse.json({ ok: true, data, configured: bankSettingsSchema.safeParse(data).success }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return adminErrorResponse(error); }
}
export async function PUT(request: Request) {
  try {
    requireSameOrigin(request); const actor = await requireAdmin('owner');
    const input = bankSettingsSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ ok: false, error: 'invalid_settings', message: 'Enter the real business bank details and a payment window from 1 to 10,080 minutes.' }, { status: 400 });
    const v = input.data;
    const { error } = await createServiceClient().rpc('owner_set_bank_settings', { p_actor_user_id: actor.user.id, p_session_id: actor.sessionId,
      p_bank_account_name: v.bank_account_name, p_bank_name: v.bank_name, p_sort_code: v.sort_code, p_account_number: v.account_number, p_window_minutes: v.bank_payment_window_minutes });
    if (error) return NextResponse.json({ ok: false, error: 'settings_not_saved' }, { status: error.code === '42501' ? 403 : 503 });
    return NextResponse.json({ ok: true });
  } catch (error) { return adminErrorResponse(error); }
}
