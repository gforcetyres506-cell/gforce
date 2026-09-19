import { NextResponse } from 'next/server';
import { adminErrorResponse, requireAdmin } from '@/lib/auth/admin';
import { getAllBookings, updateBookingStatus, createBooking, getSlots } from '@/lib/db';
import { calculatePrice } from '@/lib/pricing';
import { checkCoverage } from '@/lib/postcodes';
import { normaliseReg } from '@/lib/utils';
import type { BookingStatus, BookingWithDetails } from '@/types';

export const runtime = 'nodejs';

/**
 * GET /api/admin/bookings
 * List all bookings with optional filtering.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    return adminErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? undefined;
    const query = searchParams.get('q') ?? undefined;

    const bookings = await getAllBookings({ status, query });
    return NextResponse.json({ ok: true, data: bookings });
  } catch (err) {
    console.error('[admin/bookings/get] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error', message: 'Failed to fetch bookings.' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/bookings
 * Update booking status, assign fitter, or update notes.
 */
export async function PATCH(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    return adminErrorResponse(error);
  }

  try {
    const body = await req.json();
    const { id, status, fitterId, adminNotes } = body;

    if (!id || !status) {
      return NextResponse.json({ ok: false, error: 'missing_fields', message: 'Booking ID and status are required.' }, { status: 400 });
    }

    await updateBookingStatus(id, status as BookingStatus, fitterId, adminNotes);
    return NextResponse.json({ ok: true, message: `Booking updated to ${status}` });
  } catch (err) {
    console.error('[admin/bookings/patch] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error', message: 'Failed to update booking.' }, { status: 500 });
  }
}

/**
 * POST /api/admin/bookings
 * Create an assisted phone booking directly in the admin OS.
 */
export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    return adminErrorResponse(error);
  }

  try {
    const body = await req.json();
    const { customer, vehicle, slot_id, items, notes } = body;

    if (!customer?.email || !customer?.postcode || !slot_id || !items?.length) {
      return NextResponse.json({ ok: false, error: 'invalid_booking', message: 'Customer details, slot, and tyres are required.' }, { status: 400 });
    }

    const coverage = await checkCoverage(customer.postcode);
    const calloutCharge = coverage.covered && coverage.zone ? coverage.zone.callout_charge : 0;

    const price = await calculatePrice(items, calloutCharge);
    const bookingRef = `GF-${Math.floor(100000 + Math.random() * 900000)}`;
    const manageToken = crypto.randomUUID();

    const fullAddress = [customer.address_line1, customer.address_line2, customer.city]
      .filter(Boolean)
      .join(', ');

    const allSlots = await getSlots();
    const slot = allSlots.find((s) => s.id === slot_id) ?? null;

    const newBookingId = `booking-phone-${Date.now()}`;
    const newBooking: BookingWithDetails = {
      id: newBookingId,
      booking_ref: bookingRef,
      manage_token: manageToken,
      customer_id: `cust-${Date.now()}`,
      slot_id,
      fitter_id: null,
      vehicle_reg: vehicle?.reg ? normaliseReg(vehicle.reg) : null,
      vehicle_make: vehicle?.make || null,
      vehicle_model: vehicle?.model || null,
      vehicle_derivative: null,
      fitting_address: fullAddress || customer.address_line1,
      fitting_postcode: customer.postcode.toUpperCase(),
      customer_notes: notes ? `[PHONE BOOKING by ${admin.profile.name}] ${notes}` : `[PHONE BOOKING by ${admin.profile.name}]`,
      admin_notes: `Created via Admin phone dispatch by ${admin.profile.name}`,
      status: 'confirmed',
      tyres_total: price.tyres_total,
      fitting_fee: price.fitting_fee,
      callout_charge: price.callout_charge,
      total_amount: price.total_amount,
      deposit_amount: price.deposit_amount,
      balance_due: price.balance_due,
      stripe_payment_intent_id: `phone_${Date.now()}`,
      stripe_charge_id: `phone_staff_${Date.now()}`,
      deposit_paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer: {
        id: `cust-${Date.now()}`,
        name: customer.name ?? 'Customer',
        email: customer.email.toLowerCase(),
        phone: customer.phone ?? null,
        address_line1: customer.address_line1 ?? '',
        address_line2: customer.address_line2 ?? null,
        city: customer.city ?? 'London',
        postcode: customer.postcode.toUpperCase(),
        created_at: new Date().toISOString(),
      },
      slot,
      items: price.lines.map((l, idx) => ({
        id: `item-phone-${idx + 1}-${Date.now()}`,
        booking_id: newBookingId,
        tyre_id: l.tyre_id,
        tyre_label: l.label,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: l.line_total,
      })),
    };

    await createBooking(newBooking);

    return NextResponse.json({
      ok: true,
      data: {
        booking_ref: bookingRef,
        manage_token: manageToken,
        total_amount: price.total_amount,
        deposit_amount: price.deposit_amount,
      },
    });
  } catch (err) {
    console.error('[admin/bookings/post] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error', message: 'Failed to create phone booking.' }, { status: 500 });
  }
}
