import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import type { BookingWithDetails } from '@/types';

export const runtime = 'nodejs';
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error && error.status && error.status >= 500) throw error;
    if (error || !data.user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    const email = data.user.email?.toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: 'invalid_user' }, { status: 400 });
    const db = createServiceClient();
    const profile = await db.from('customers').select('*').eq('email', email).maybeSingle();
    if (profile.error) throw profile.error;
    let bookings: BookingWithDetails[] = [];
    if (profile.data?.id) {
      const result = await db.from('bookings').select('*, customer:customers(*), slot:booking_slots(*), items:booking_items(*)')
        .eq('customer_id', profile.data.id).order('created_at', { ascending: false });
      if (result.error || !result.data) throw new Error('Booking read failed.');
      bookings = result.data as unknown as BookingWithDetails[];
    }
    const vehicles = new Map<string, { reg: string; make: string; model: string; lastUsed: string }>();
    for (const booking of bookings) {
      if (booking.vehicle_reg && !vehicles.has(booking.vehicle_reg)) vehicles.set(booking.vehicle_reg, {
        reg: booking.vehicle_reg, make: booking.vehicle_make ?? '', model: booking.vehicle_model ?? '', lastUsed: booking.created_at,
      });
    }
    return NextResponse.json({ ok: true, data: {
      user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name ?? profile.data?.name ?? '',
        phone: data.user.user_metadata?.phone ?? profile.data?.phone ?? '' },
      customer: profile.data, bookings, vehicles: [...vehicles.values()],
    } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: 'Account service unavailable.' }, { status: 503 });
  }
}
