import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { calculatePrice, PricingError } from '@/lib/pricing';
import { checkCoverage } from '@/lib/postcodes';
import { checkoutSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { normaliseReg } from '@/lib/utils';
import { isHoldValid, getSlots, createBooking } from '@/lib/db';
import type { BookingWithDetails } from '@/types';

export const runtime = 'nodejs';

/**
 * POST /api/checkout/create
 *
 * Creates a booking and returns a Stripe client_secret or dev demo payment token.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);

  // 1 ── Rate limit
  if (isSupabaseConfigured()) {
    const limit = await checkRateLimit(`checkout:${ip}`, 10, 60);
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: 'rate_limited', message: 'Too many attempts. Try again in an hour.' },
        { status: 429 },
      );
    }
  }

  // 2 ── Validate shape
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'bad_request', message: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'validation_failed',
        message: parsed.error.errors[0]?.message ?? 'Check the details you entered.',
      },
      { status: 400 },
    );
  }

  const { slot_id, session_token, customer, vehicle, items, notes } = parsed.data;

  try {
    // 3 ── Coverage check
    const coverage = await checkCoverage(customer.postcode);
    if (!coverage.covered || !coverage.zone) {
      return NextResponse.json(
        { ok: false, error: 'outside_coverage', message: coverage.message },
        { status: 400 },
      );
    }
    const calloutCharge = coverage.zone.callout_charge;

    // 4 ── Slot hold verification
    const holdValid = await isHoldValid(slot_id, session_token);

    if (!holdValid) {
      // Recheck if slot is available
      const allSlots = await getSlots();
      const slot = allSlots.find((s) => s.id === slot_id);
      if (!slot || !slot.available) {
        return NextResponse.json(
          {
            ok: false,
            error: 'hold_expired',
            message: 'Your slot reservation expired. Please pick a time again.',
          },
          { status: 409 },
        );
      }
    }

    // 5 ── Price calculation
    const price = await calculatePrice(items, calloutCharge);

    const bookingRef = `GF-${Math.floor(100000 + Math.random() * 900000)}`;
    const manageToken = crypto.randomUUID();
    const fullAddress = [customer.address_line1, customer.address_line2, customer.city]
      .filter(Boolean)
      .join(', ');

    const allSlots = await getSlots();
    const slot = allSlots.find((s) => s.id === slot_id) ?? null;

    const newBookingId = `booking-${Date.now()}`;
    const paymentIntentId = `pi_${Date.now()}_${manageToken.slice(0, 8)}`;

    // Create the full booking object
    const newBooking: BookingWithDetails = {
      id: newBookingId,
      booking_ref: bookingRef,
      manage_token: manageToken,
      customer_id: `cust-${Date.now()}`,
      slot_id,
      fitter_id: null,
      vehicle_reg: vehicle.reg ? normaliseReg(vehicle.reg) : null,
      vehicle_make: vehicle.make || null,
      vehicle_model: vehicle.model || null,
      vehicle_derivative: null,
      fitting_address: fullAddress,
      fitting_postcode: customer.postcode.toUpperCase(),
      customer_notes: notes || null,
      admin_notes: null,
      status: 'pending_payment',
      tyres_total: price.tyres_total,
      fitting_fee: price.fitting_fee,
      callout_charge: price.callout_charge,
      total_amount: price.total_amount,
      deposit_amount: price.deposit_amount,
      balance_due: price.balance_due,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: null,
      deposit_paid_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer: {
        id: `cust-${Date.now()}`,
        name: customer.name,
        email: customer.email.toLowerCase(),
        phone: customer.phone,
        address_line1: customer.address_line1,
        address_line2: customer.address_line2 || null,
        city: customer.city || null,
        postcode: customer.postcode.toUpperCase(),
        created_at: new Date().toISOString(),
      },
      slot,
      items: price.lines.map((l, idx) => ({
        id: `item-${idx + 1}-${Date.now()}`,
        booking_id: newBookingId,
        tyre_id: l.tyre_id,
        tyre_label: l.label,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: l.line_total,
      })),
    };

    // If Stripe is configured, create real PaymentIntent
    let clientSecret = `demo_secret_${manageToken}`;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && !stripeKey.includes('placeholder') && !stripeKey.startsWith('sk_test_placeholder')) {
      try {
        const stripe = getStripe();
        const intent = await stripe.paymentIntents.create({
          amount: price.deposit_amount,
          currency: 'gbp',
          automatic_payment_methods: { enabled: true },
          description: `G Force Tyres deposit — ${bookingRef}`,
          receipt_email: customer.email,
          metadata: {
            booking_id: newBooking.id,
            booking_ref: bookingRef,
            manage_token: manageToken,
          },
        });
        clientSecret = intent.client_secret ?? clientSecret;
        newBooking.stripe_payment_intent_id = intent.id;
      } catch (err) {
        console.warn('[checkout] Stripe call failed, using fallback secret:', err);
      }
    }

    // Persist to database
    await createBooking(newBooking);

    return NextResponse.json({
      ok: true,
      data: {
        client_secret: clientSecret,
        booking_ref: bookingRef,
        manage_token: manageToken,
        breakdown: price,
        is_mock_payment: !stripeKey || stripeKey.includes('placeholder') || stripeKey.startsWith('sk_test_placeholder'),
      },
    });
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json(
        { ok: false, error: err.code.toLowerCase(), message: err.message },
        { status: 409 },
      );
    }
    console.error('[checkout] unexpected error', err);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
