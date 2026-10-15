import { NextResponse } from 'next/server';
import { getBookingByToken } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!z.string().uuid().safeParse(token).success) return NextResponse.json({ ok: false, error: 'not_found', message: 'Booking not found.' }, { status: 404 });
    const booking = await getBookingByToken(token);
    if (!booking) return NextResponse.json({ ok: false, error: 'not_found', message: 'Booking not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, data: booking }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: 'Booking service unavailable. Please try again later.' }, { status: 503 });
  }
}

/** Cancellation/refund must be atomic and verified before this can accept it. */
export async function POST() {
  return NextResponse.json({ ok: false, error: 'service_unavailable',
    message: 'Online booking changes are unavailable. Your booking has not been changed. Please contact us.',
  }, { status: 503 });
}
