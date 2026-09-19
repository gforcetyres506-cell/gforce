import { NextResponse } from 'next/server';
import { getBookingByRef, confirmBookingPaid } from '@/lib/db';
import { sendBookingConfirmed } from '@/lib/email';
import { isMockDataEnabled } from '@/lib/mock-mode';

export const runtime = 'nodejs';

/**
 * POST /api/checkout/confirm-mock
 * Confirms a booking in sandbox / test mode without a live Stripe webhook.
 * Decrements stock, releases hold, persists confirmed status, and triggers email.
 */
export async function POST(req: Request) {
  if (!isMockDataEnabled()) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  try {
    const { booking_ref } = await req.json();
    if (!booking_ref) {
      return NextResponse.json({ ok: false, error: 'missing_ref', message: 'Booking reference is required.' }, { status: 400 });
    }

    const booking = await getBookingByRef(booking_ref);
    if (!booking) {
      return NextResponse.json({ ok: false, error: 'not_found', message: 'Booking not found.' }, { status: 404 });
    }

    const piId = booking.stripe_payment_intent_id ?? `pi_mock_${booking.id}`;
    await confirmBookingPaid(piId, `ch_mock_${Date.now()}`);

    // Fetch refreshed booking
    const updated = await getBookingByRef(booking_ref);
    if (updated) {
      // Send confirmation email asynchronously if configured
      void sendBookingConfirmed(updated).catch((err) => {
        console.warn('[checkout/confirm-mock] Email dispatch failed (non-fatal):', err);
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        status: 'confirmed',
        booking_ref,
        deposit_paid_at: updated?.deposit_paid_at ?? new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[checkout/confirm-mock] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error', message: 'Failed to confirm booking.' }, { status: 500 });
  }
}
