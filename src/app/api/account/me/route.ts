import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import type { BookingWithDetails } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const email = authData.user.email?.toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: 'invalid_user' }, { status: 400 });
    }

    let customerProfile = null;
    let customerBookings: BookingWithDetails[] = [];

    if (isSupabaseConfigured()) {
      const db = createServiceClient();

      // 1. Fetch customer profile
      const { data: cust } = await db
        .from('customers')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      customerProfile = cust;

      // 2. Fetch all bookings for this customer
      let bookingQuery = db
        .from('bookings')
        .select(
          `
          *,
          customer:customers(*),
          slot:booking_slots(*),
          items:booking_items(*)
        `,
        )
        .order('created_at', { ascending: false });

      if (cust?.id) {
        bookingQuery = bookingQuery.eq('customer_id', cust.id);
      } else {
        // Fallback search by fitting postcode or ignore if no customer record yet
        bookingQuery = bookingQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { data: bList } = await bookingQuery;
      if (bList) {
        customerBookings = bList as BookingWithDetails[];
      }
    }

    // Extract saved vehicles from past bookings
    const vehicleMap = new Map<string, { reg: string; make: string; model: string; lastUsed: string }>();
    customerBookings.forEach((b) => {
      if (b.vehicle_reg) {
        const key = b.vehicle_reg.toUpperCase().replace(/\s+/g, '');
        if (!vehicleMap.has(key)) {
          vehicleMap.set(key, {
            reg: b.vehicle_reg,
            make: b.vehicle_make ?? '',
            model: b.vehicle_model ?? '',
            lastUsed: b.created_at,
          });
        }
      }
    });

    const savedVehicles = Array.from(vehicleMap.values());

    return NextResponse.json({
      ok: true,
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: authData.user.user_metadata?.name || customerProfile?.name || '',
          phone: authData.user.user_metadata?.phone || customerProfile?.phone || '',
        },
        customer: customerProfile,
        bookings: customerBookings,
        vehicles: savedVehicles,
      },
    });
  } catch (err) {
    console.error('[account/me] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
