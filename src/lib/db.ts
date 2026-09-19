import { createServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import { localStore, MOCK_FITTERS, MOCK_SETTINGS } from '@/lib/mockData';
import type {
  Tyre,
  SlotWithAvailability,
  SlotHold,
  BookingWithDetails,
  BookingStatus,
  AppSettings,
} from '@/types';

/**
 * Central Database Service for G Force Tyres.
 * When Supabase is configured, persists all reads and writes to PostgreSQL.
 * If Supabase is not configured yet or tables are fresh, seamlessly falls back
 * to localStore / seed state to ensure zero downtime on Vercel.
 */

// ── Catalogue / Tyres ──────────────────────────────────────────

export async function getTyres(filters?: {
  width?: number;
  profile?: number;
  rim?: number;
  tier?: string;
  season?: string;
}): Promise<Tyre[]> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      let query = db.from('tyre_inventory').select('*').eq('active', true);

      if (filters?.width) query = query.eq('width', filters.width);
      if (filters?.profile) query = query.eq('profile', filters.profile);
      if (filters?.rim) query = query.eq('rim', filters.rim);
      if (filters?.tier && filters.tier !== 'all') query = query.eq('tier', filters.tier);
      if (filters?.season && filters.season !== 'all') query = query.eq('season', filters.season);

      query = query.order('tier', { ascending: false }).order('sell_price', { ascending: true });

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as Tyre[];
      }
    } catch (err) {
      console.warn('[db.getTyres] Supabase query failed, using local catalogue:', err);
    }
  }

  // Local fallback
  let list = localStore.getAllTyres().filter((t) => t.active);
  if (filters?.width && filters?.profile && filters?.rim) {
    list = localStore.getTyres(filters.width, filters.profile, filters.rim);
  }
  if (filters?.tier && filters.tier !== 'all') {
    list = list.filter((t) => t.tier === filters.tier);
  }
  if (filters?.season && filters.season !== 'all') {
    list = list.filter((t) => t.season === filters.season);
  }
  return list;
}

export async function getTyreById(id: string): Promise<Tyre | null> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { data, error } = await db
        .from('tyre_inventory')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) return data as Tyre;
    } catch (err) {
      console.warn('[db.getTyreById] Supabase query failed:', err);
    }
  }
  return localStore.getTyreById(id) ?? null;
}

export async function getAllTyresAdmin(): Promise<Tyre[]> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { data, error } = await db
        .from('tyre_inventory')
        .select('*')
        .order('brand', { ascending: true })
        .order('model', { ascending: true });
      if (!error && data && data.length > 0) {
        return data as Tyre[];
      }
    } catch (err) {
      console.warn('[db.getAllTyresAdmin] Supabase query failed:', err);
    }
  }
  return localStore.getAllTyres();
}

export async function updateTyreStock(id: string, newStock: number): Promise<boolean> {
  localStore.updateTyreStock(id, newStock);
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { error } = await db
        .from('tyre_inventory')
        .update({ stock: newStock })
        .eq('id', id);
      return !error;
    } catch (err) {
      console.warn('[db.updateTyreStock] Supabase update failed:', err);
    }
  }
  return true;
}

export async function updateTyrePrice(id: string, sellPricePence: number): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { error } = await db
        .from('tyre_inventory')
        .update({ sell_price: sellPricePence })
        .eq('id', id);
      return !error;
    } catch (err) {
      console.warn('[db.updateTyrePrice] Supabase update failed:', err);
    }
  }
  return true;
}

export async function createTyre(tyre: Omit<Tyre, 'id' | 'created_at'>): Promise<Tyre | null> {
  const newId = `tyre-${Date.now()}`;
  const now = new Date().toISOString();
  const created: Tyre = { ...tyre, id: newId, created_at: now };

  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { data, error } = await db
        .from('tyre_inventory')
        .insert([{ ...tyre }])
        .select('*')
        .single();
      if (!error && data) {
        return data as Tyre;
      }
    } catch (err) {
      console.warn('[db.createTyre] Supabase insert failed:', err);
    }
  }

  // Local fallback
  return created;
}

// ── Slots & Availability ───────────────────────────────────────

export async function getSlots(date?: string): Promise<SlotWithAvailability[]> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      let query = db
        .from('booking_slots')
        .select('*')
        .eq('active', true)
        .order('slot_date', { ascending: true })
        .order('start_time', { ascending: true });

      const todayStr = new Date().toISOString().split('T')[0];
      if (date) {
        query = query.eq('slot_date', date);
      } else {
        query = query.gte('slot_date', todayStr);
      }

      const { data: rawSlots, error: slotsErr } = await query;
      if (!slotsErr && rawSlots && rawSlots.length > 0) {
        const slotIds = rawSlots.map((s) => s.id);

        // Fetch active bookings occupying these slots
        const { data: bookings } = await db
          .from('bookings')
          .select('slot_id')
          .in('slot_id', slotIds)
          .not('status', 'in', '("cancelled","refunded","payment_failed")');

        // Fetch active unexpired holds
        const { data: holds } = await db
          .from('slot_holds')
          .select('slot_id')
          .in('slot_id', slotIds)
          .gt('expires_at', new Date().toISOString());

        const bookingCountMap = new Map<string, number>();
        (bookings ?? []).forEach((b) => {
          if (b.slot_id) {
            bookingCountMap.set(b.slot_id, (bookingCountMap.get(b.slot_id) ?? 0) + 1);
          }
        });

        const holdCountMap = new Map<string, number>();
        (holds ?? []).forEach((h) => {
          if (h.slot_id) {
            holdCountMap.set(h.slot_id, (holdCountMap.get(h.slot_id) ?? 0) + 1);
          }
        });

        const computed: SlotWithAvailability[] = rawSlots.map((s) => {
          const booked = bookingCountMap.get(s.id) ?? 0;
          const held = holdCountMap.get(s.id) ?? 0;
          const remaining = Math.max(0, s.max_bookings - booked - held);
          return {
            ...s,
            remaining,
            available: remaining > 0,
          };
        });

        return computed;
      }
    } catch (err) {
      console.warn('[db.getSlots] Supabase query failed, using local slots:', err);
    }
  }

  // Local fallback
  return localStore.getSlots(date);
}

export async function createSlotHold(
  slotId: string,
  sessionToken: string,
  minutes = 15,
): Promise<SlotHold | null> {
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      // Try database RPC first if exists
      const { data, error } = await db.rpc('create_slot_hold', {
        p_slot_id: slotId,
        p_session_token: sessionToken,
        p_minutes: minutes,
      });

      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        return {
          hold_id: row.hold_id,
          slot_id: slotId,
          expires_at: row.expires_at,
        };
      }

      // If RPC is not defined or failed, perform atomic check and insert
      const { data: slot } = await db
        .from('booking_slots')
        .select('id, max_bookings')
        .eq('id', slotId)
        .single();

      if (slot) {
        const { count: bookedCount } = await db
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('slot_id', slotId)
          .not('status', 'in', '("cancelled","refunded","payment_failed")');

        const { count: holdCount } = await db
          .from('slot_holds')
          .select('*', { count: 'exact', head: true })
          .eq('slot_id', slotId)
          .gt('expires_at', new Date().toISOString());

        const remaining = slot.max_bookings - (bookedCount ?? 0) - (holdCount ?? 0);
        if (remaining <= 0) return null;

        // Delete any previous hold for this session
        await db
          .from('slot_holds')
          .delete()
          .eq('slot_id', slotId)
          .eq('session_token', sessionToken);

        const { data: newHold, error: insertErr } = await db
          .from('slot_holds')
          .insert({
            slot_id: slotId,
            session_token: sessionToken,
            expires_at: expiresAt,
          })
          .select('id, expires_at')
          .single();

        if (!insertErr && newHold) {
          return {
            hold_id: newHold.id,
            slot_id: slotId,
            expires_at: newHold.expires_at,
          };
        }
      }
    } catch (err) {
      console.warn('[db.createSlotHold] Supabase hold failed, using local store:', err);
    }
  }

  // Local fallback
  const h = localStore.createHold(slotId, sessionToken, minutes);
  return h ? { hold_id: h.hold_id, slot_id: slotId, expires_at: h.expires_at } : null;
}

export async function releaseSlotHold(slotId: string, sessionToken: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      await db
        .from('slot_holds')
        .delete()
        .eq('slot_id', slotId)
        .eq('session_token', sessionToken);
    } catch (err) {
      console.warn('[db.releaseSlotHold] Supabase release failed:', err);
    }
  }
  localStore.releaseHold(slotId, sessionToken);
  return true;
}

export async function isHoldValid(slotId: string, sessionToken: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { data } = await db
        .from('slot_holds')
        .select('id')
        .eq('slot_id', slotId)
        .eq('session_token', sessionToken)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (data) return true;
    } catch {
      // fallback
    }
  }
  return localStore.isHoldValid(slotId, sessionToken);
}

export async function generateSlots(
  startDate: string,
  daysAhead = 14,
  times = [
    { start: '08:30:00', end: '11:00:00' },
    { start: '11:30:00', end: '14:00:00' },
    { start: '14:30:00', end: '17:00:00' },
  ],
  maxBookings = 2,
): Promise<number> {
  const generated: Array<{ slot_date: string; start_time: string; end_time: string; max_bookings: number }> = [];
  const baseDate = new Date(startDate);

  for (let d = 0; d < daysAhead; d++) {
    const cur = new Date(baseDate);
    cur.setDate(baseDate.getDate() + d);
    // Skip Sundays
    if (cur.getDay() === 0) continue;
    const dateStr = cur.toISOString().split('T')[0];

    for (const t of times) {
      generated.push({
        slot_date: dateStr,
        start_time: t.start,
        end_time: t.end,
        max_bookings: maxBookings,
      });
    }
  }

  let count = 0;
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { data, error } = await db
        .from('booking_slots')
        .upsert(generated, { onConflict: 'slot_date,start_time' })
        .select('id');
      if (!error && data) count = data.length;
    } catch (err) {
      console.warn('[db.generateSlots] Supabase generation failed:', err);
    }
  }

  const weeks = Math.max(1, Math.ceil(daysAhead / 7));
  localStore.generateRecurringSlots(startDate, weeks, [1, 2, 3, 4, 5, 6], times, maxBookings);
  return count > 0 ? count : generated.length;
}

export async function updateSlotCapacity(slotId: string, maxBookings: number): Promise<boolean> {
  localStore.setSlotCapacity(slotId, maxBookings);
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      await db.from('booking_slots').update({ max_bookings: maxBookings }).eq('id', slotId);
    } catch (err) {
      console.warn('[db.updateSlotCapacity] Supabase update failed:', err);
    }
  }
  return true;
}

// ── Bookings & Customers ───────────────────────────────────────

export async function createBooking(booking: BookingWithDetails): Promise<BookingWithDetails> {
  // Always update in-memory mirror
  localStore.createBooking(booking);

  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();

      // 1. Upsert Customer
      let customerId = booking.customer_id;
      if (booking.customer && booking.customer.email) {
        const { data: custData, error: custErr } = await db
          .from('customers')
          .upsert(
            {
              email: booking.customer.email.toLowerCase(),
              name: booking.customer.name,
              phone: booking.customer.phone,
              address_line1: booking.customer.address_line1,
              address_line2: booking.customer.address_line2,
              city: booking.customer.city,
              postcode: booking.customer.postcode,
            },
            { onConflict: 'email' },
          )
          .select('id')
          .single();

        if (!custErr && custData) {
          customerId = custData.id;
          booking.customer_id = custData.id;
        }
      }

      // 2. Insert Booking row
      const { data: bRow, error: bErr } = await db
        .from('bookings')
        .insert({
          booking_ref: booking.booking_ref,
          manage_token: booking.manage_token,
          customer_id: customerId,
          slot_id: booking.slot_id,
          fitter_id: booking.fitter_id,
          vehicle_reg: booking.vehicle_reg,
          vehicle_make: booking.vehicle_make,
          vehicle_model: booking.vehicle_model,
          vehicle_derivative: booking.vehicle_derivative,
          fitting_address: booking.fitting_address,
          fitting_postcode: booking.fitting_postcode,
          customer_notes: booking.customer_notes,
          admin_notes: booking.admin_notes,
          status: booking.status,
          tyres_total: booking.tyres_total,
          fitting_fee: booking.fitting_fee,
          callout_charge: booking.callout_charge,
          total_amount: booking.total_amount,
          deposit_amount: booking.deposit_amount,
          balance_due: booking.balance_due,
          stripe_payment_intent_id: booking.stripe_payment_intent_id,
          stripe_charge_id: booking.stripe_charge_id,
          deposit_paid_at: booking.deposit_paid_at,
        })
        .select('id')
        .single();

      if (!bErr && bRow) {
        booking.id = bRow.id;

        // 3. Insert Line Items
        if (booking.items && booking.items.length > 0) {
          const itemsPayload = booking.items.map((item) => ({
            booking_id: bRow.id,
            tyre_id: item.tyre_id,
            tyre_label: item.tyre_label,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
          }));

          await db.from('booking_items').insert(itemsPayload);
        }
      }
    } catch (err) {
      console.warn('[db.createBooking] Supabase insert failed, persisted locally:', err);
    }
  }

  return booking;
}

export async function getBookingByRef(ref: string): Promise<BookingWithDetails | null> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { data, error } = await db
        .from('bookings')
        .select('*, customer:customers(*), slot:booking_slots(*), items:booking_items(*)')
        .eq('booking_ref', ref)
        .maybeSingle();

      if (!error && data) {
        return data as unknown as BookingWithDetails;
      }
    } catch (err) {
      console.warn('[db.getBookingByRef] Supabase query failed:', err);
    }
  }

  return localStore.getBookingByRef(ref) ?? null;
}

export async function getBookingByToken(token: string): Promise<BookingWithDetails | null> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { data, error } = await db
        .from('bookings')
        .select('*, customer:customers(*), slot:booking_slots(*), items:booking_items(*)')
        .eq('manage_token', token)
        .maybeSingle();

      if (!error && data) {
        return data as unknown as BookingWithDetails;
      }
    } catch (err) {
      console.warn('[db.getBookingByToken] Supabase query failed:', err);
    }
  }

  return localStore.getBookingByToken(token) ?? null;
}

export async function getBookingById(id: string): Promise<BookingWithDetails | null> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { data, error } = await db
        .from('bookings')
        .select('*, customer:customers(*), slot:booking_slots(*), items:booking_items(*)')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return data as unknown as BookingWithDetails;
      }
    } catch (err) {
      console.warn('[db.getBookingById] Supabase query failed:', err);
    }
  }

  return localStore.getAllBookings().find((b) => b.id === id) ?? null;
}

export async function getAllBookings(filters?: {
  status?: string;
  query?: string;
}): Promise<BookingWithDetails[]> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      let query = db
        .from('bookings')
        .select('*, customer:customers(*), slot:booking_slots(*), items:booking_items(*)')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (!error && data) {
        let list = data as unknown as BookingWithDetails[];
        if (filters?.query) {
          const q = filters.query.toLowerCase().trim();
          list = list.filter(
            (b) =>
              b.booking_ref.toLowerCase().includes(q) ||
              (b.vehicle_reg && b.vehicle_reg.toLowerCase().includes(q)) ||
              (b.customer && b.customer.name && b.customer.name.toLowerCase().includes(q)) ||
              (b.customer && b.customer.email && b.customer.email.toLowerCase().includes(q)) ||
              (b.customer && b.customer.phone && b.customer.phone.toLowerCase().includes(q)),
          );
        }
        return list;
      }
    } catch (err) {
      console.warn('[db.getAllBookings] Supabase query failed, using local store:', err);
    }
  }

  let list = localStore.getAllBookings();
  if (filters?.status && filters.status !== 'all') {
    list = list.filter((b) => b.status === filters.status);
  }
  if (filters?.query) {
    const q = filters.query.toLowerCase().trim();
    list = list.filter(
      (b) =>
        b.booking_ref.toLowerCase().includes(q) ||
        (b.vehicle_reg && b.vehicle_reg.toLowerCase().includes(q)) ||
        (b.customer && b.customer.name && b.customer.name.toLowerCase().includes(q)) ||
        (b.customer && b.customer.email && b.customer.email.toLowerCase().includes(q)),
    );
  }
  return list;
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
  fitterId?: string | null,
  adminNotes?: string | null,
): Promise<boolean> {
  localStore.updateBookingStatus(id, status, fitterId ?? undefined);

  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (fitterId !== undefined) payload.fitter_id = fitterId;
      if (adminNotes !== undefined) payload.admin_notes = adminNotes;

      const { error } = await db.from('bookings').update(payload).eq('id', id);
      if (!error) {
        await recordAudit('admin', `booking_${status}`, 'booking', id, { status, fitter_id: fitterId });
        return true;
      }
    } catch (err) {
      console.warn('[db.updateBookingStatus] Supabase update failed:', err);
    }
  }

  return true;
}

export async function confirmBookingPaid(
  paymentIntentId: string,
  chargeId?: string,
): Promise<string | null> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();

      // Try RPC first
      const { data: rpcBookingId, error: rpcErr } = await db.rpc('confirm_booking_paid', {
        p_payment_intent_id: paymentIntentId,
        p_charge_id: chargeId ?? '',
      });

      if (!rpcErr && rpcBookingId) {
        return rpcBookingId as string;
      }

      // Manual fallback in PostgreSQL
      const { data: b } = await db
        .from('bookings')
        .select('*, items:booking_items(*)')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (b) {
        // Decrement stock
        if (b.items && Array.isArray(b.items)) {
          for (const item of b.items) {
            if (item.tyre_id) {
              const { data: tyre } = await db
                .from('tyre_inventory')
                .select('stock')
                .eq('id', item.tyre_id)
                .single();
              if (tyre) {
                const newStock = Math.max(0, tyre.stock - item.quantity);
                await db.from('tyre_inventory').update({ stock: newStock }).eq('id', item.tyre_id);
              }
            }
          }
        }

        // Update booking status
        await db
          .from('bookings')
          .update({
            status: 'confirmed',
            stripe_charge_id: chargeId ?? `ch_${Date.now()}`,
            deposit_paid_at: new Date().toISOString(),
          })
          .eq('id', b.id);

        // Delete slot hold
        if (b.slot_id) {
          await db.from('slot_holds').delete().eq('slot_id', b.slot_id);
        }

        await recordAudit('system', 'booking_confirmed', 'booking', b.id, { payment_intent: paymentIntentId });
        return b.id;
      }
    } catch (err) {
      console.warn('[db.confirmBookingPaid] Supabase confirmation failed:', err);
    }
  }

  // Local fallback
  const booking = localStore.getAllBookings().find((b) => b.stripe_payment_intent_id === paymentIntentId);
  if (booking) {
    localStore.updateBookingStatus(booking.id, 'confirmed');
    booking.deposit_paid_at = new Date().toISOString();
    return booking.id;
  }

  return null;
}

export async function cancelBooking(id: string, reason?: string): Promise<boolean> {
  const booking = await getBookingById(id);
  if (!booking) return false;

  localStore.updateBookingStatus(id, 'cancelled');

  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      // Restore stock
      if (booking.items && Array.isArray(booking.items)) {
        for (const item of booking.items) {
          if (item.tyre_id) {
            const { data: tyre } = await db
              .from('tyre_inventory')
              .select('stock')
              .eq('id', item.tyre_id)
              .single();
            if (tyre) {
              await db.from('tyre_inventory').update({ stock: tyre.stock + item.quantity }).eq('id', item.tyre_id);
            }
          }
        }
      }

      await db
        .from('bookings')
        .update({ status: 'cancelled', admin_notes: reason ? `Cancelled: ${reason}` : 'Cancelled by customer/admin' })
        .eq('id', id);

      await recordAudit('system', 'booking_cancelled', 'booking', id, { reason });
      return true;
    } catch (err) {
      console.warn('[db.cancelBooking] Supabase cancel failed:', err);
    }
  }

  return true;
}

// ── Fitters & Settings ─────────────────────────────────────────

export async function getFitters(): Promise<Array<{ id: string; name: string; phone?: string | null; active: boolean }>> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { data, error } = await db.from('fitters').select('*').eq('active', true);
      if (!error && data && data.length > 0) return data;
    } catch {
      // fallback
    }
  }
  return MOCK_FITTERS;
}

export async function getSettings(): Promise<AppSettings> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { data, error } = await db.from('app_settings').select('*').eq('id', 1).maybeSingle();
      if (!error && data) return data as AppSettings;
    } catch {
      // fallback
    }
  }
  return MOCK_SETTINGS;
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      const { error } = await db.from('app_settings').update(settings).eq('id', 1);
      return !error;
    } catch {
      // fallback
    }
  }
  return true;
}

// ── Audit Log ──────────────────────────────────────────────────

export async function recordAudit(
  actor: string,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const db = createServiceClient();
      await db.from('audit_log').insert({
        actor,
        action,
        entity,
        entity_id: entityId ?? null,
        metadata: metadata ?? {},
      });
    } catch {
      // Best effort
    }
  }
}
