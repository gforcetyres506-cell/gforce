import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * The verified booking/payment engine is absent from the ordered migrations.
 * Fail before any database or Stripe write. Re-enable in the payment recovery
 * gate only after atomic booking, inventory reservation and payment persistence.
 */
export async function POST() {
  return NextResponse.json({
    ok: false, error: 'service_unavailable',
    message: 'Online booking payments are unavailable. No booking has been created. Please try again later.',
  }, { status: 503 });
}
