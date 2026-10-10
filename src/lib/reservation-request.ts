import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkoutSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase';
import { resolvePostcode } from '@/lib/postcodes';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { reservationSchema } from '@/lib/checkout-result';

import type { AdminContext } from '@/lib/auth/admin';

const errors: Record<string, { status: number; error: string; message: string }> = {
  P3001: { status: 503, error: 'bank_details_not_configured', message: 'Bank payment is blocked until G Force configures its business bank details.' },
  P2001: { status: 400, error: 'invalid_checkout', message: 'Check your tyres and contact details.' },
  P2002: { status: 409, error: 'slot_conflict', message: 'That fitting time could not be reserved. Please choose another.' },
  P2003: { status: 409, error: 'out_of_stock', message: 'The selected tyre quantity is no longer available. Please return to search.' },
  P2004: { status: 503, error: 'pricing_unavailable', message: 'Pricing unavailable. Cannot continue.' },
  P2005: { status: 409, error: 'checkout_key_reused', message: 'This checkout already has a reservation. Return to your booking before starting another.' },
  P2006: { status: 400, error: 'outside_coverage', message: 'The fitting postcode is outside our service area.' },
};
export async function handleReservationRequest(req: Request, actor?: AdminContext) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  const input = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ ok: false, error: 'invalid_checkout', message: 'Check your tyres and contact details.' }, { status: 400 });
  try {
    const limit = await checkRateLimit('checkout:' + getClientIp(req), 30, 10);
    if (!limit.allowed) return NextResponse.json({ ok: false, error: 'rate_limited', message: 'Too many attempts. Please try again later.' }, { status: 429 });
    const postcode = await resolvePostcode(input.data.customer.postcode);
    if (!postcode) return NextResponse.json({ ok: false, error: 'invalid_postcode', message: 'Enter a valid fitting postcode.' }, { status: 400 });
    const v = input.data;
    const { data, error } = await createServiceClient().rpc(actor ? 'admin_reserve_phone_booking' : 'reserve_booking_checkout', {
      ...(actor ? { p_actor_user_id: actor.user.id, p_session_id: actor.sessionId } : {}),
      p_checkout_key: v.session_token, p_slot_id: v.slot_id, p_items: v.items,
      p_customer: v.customer, p_postcode: postcode.postcode, p_vehicle: v.vehicle, p_notes: v.notes || null,
    });
    if (error) {
      const known = errors[error.code];
      if (!known) throw new Error('Reservation could not be verified');
      return NextResponse.json({ ok: false, error: known.error, message: known.message }, { status: known.status });
    }
    const parsed = z.array(reservationSchema).length(1).safeParse(data);
    if (!parsed.success) throw new Error('Reservation response could not be verified');
    return NextResponse.json({ ok: true, data: parsed.data[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // A response can be lost AFTER commit. Do not falsely claim nothing was
    // created; retry with the same checkout key retrieves the original booking.
    return NextResponse.json({ ok: false, error: 'service_unavailable',
      message: 'Your reservation could not be verified. Retry this checkout to check the same booking.' }, { status: 503 });
  }
}
