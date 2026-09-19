import { NextResponse } from 'next/server';
import { getBookingByToken, cancelBooking } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/manage/[token]
 * Retrieve full booking details by secure customer manage token.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'missing_token', message: 'Token is required.' }, { status: 400 });
    }

    const booking = await getBookingByToken(token);
    if (!booking) {
      return NextResponse.json({ ok: false, error: 'not_found', message: 'Booking not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: booking });
  } catch (err) {
    console.error('[manage/get] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error', message: 'Could not load booking.' }, { status: 500 });
  }
}

/**
 * POST /api/manage/[token]
 * Self-service actions on booking (e.g. cancel).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const booking = await getBookingByToken(token);
    if (!booking) {
      return NextResponse.json({ ok: false, error: 'not_found', message: 'Booking not found.' }, { status: 404 });
    }

    if (action === 'cancel') {
      if (['completed', 'en_route', 'cancelled', 'refunded'].includes(booking.status)) {
        return NextResponse.json(
          { ok: false, error: 'invalid_status', message: `Cannot cancel a booking that is ${booking.status}.` },
          { status: 400 },
        );
      }

      await cancelBooking(booking.id, body.reason ?? 'Customer requested cancellation via manage link');
      const updated = await getBookingByToken(token);
      return NextResponse.json({ ok: true, data: updated });
    }

    return NextResponse.json({ ok: false, error: 'unknown_action', message: 'Unsupported action.' }, { status: 400 });
  } catch (err) {
    console.error('[manage/post] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error', message: 'Action failed.' }, { status: 500 });
  }
}
