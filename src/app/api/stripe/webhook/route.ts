import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Keep the signature boundary, but never acknowledge an unpersisted business
 * transition. Ordered migrations lack the verified payment/refund engine.
 * Returning 503 on relevant signed events preserves provider retries.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'no_signature' }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }
  if (['payment_intent.succeeded', 'payment_intent.payment_failed', 'charge.refunded'].includes(event.type)) {
    return NextResponse.json({ error: 'payment_engine_unavailable' }, { status: 503 });
  }
  return NextResponse.json({ received: true });
}
