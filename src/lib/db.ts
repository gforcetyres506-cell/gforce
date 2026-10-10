import 'server-only';
import { z } from 'zod';
import { createServiceClient } from './supabase';
import { ServiceUnavailableError } from './service-error';
import type { AppSettings, BookingWithDetails, SlotHold, SlotWithAvailability, Tyre } from '@/types';

// Existing runtime contracts only. Missing tables/RPCs are outages;
// reconciling the database architecture belongs to the next recovery gate.
const tyreSchema = z.object({
  id: z.string().min(1), brand: z.string().min(1), model: z.string().min(1),
  width: z.number().int().min(115).max(355), profile: z.number().int().min(20).max(85),
  rim: z.number().int().min(12).max(24), sell_price: z.number().int().positive().safe(),
  stock: z.number().int().nonnegative().safe(), active: z.boolean(),
}).passthrough();

export function validateTyres(data: unknown): Tyre[] {
  const parsed = z.array(tyreSchema).safeParse(data);
  if (!parsed.success) throw new ServiceUnavailableError('Inventory unavailable. Please try again later.');
  return parsed.data as unknown as Tyre[];
}

export async function getTyres(filters: {
  width?: number; profile?: number; rim?: number; tier?: string; season?: string;
} = {}): Promise<Tyre[]> {
  const db = createServiceClient();
  let query = db.from('tyre_inventory').select('*').eq('active', true);
  if (filters.width !== undefined) query = query.eq('width', filters.width);
  if (filters.profile !== undefined) query = query.eq('profile', filters.profile);
  if (filters.rim !== undefined) query = query.eq('rim', filters.rim);
  if (filters.tier) query = query.eq('tier', filters.tier);
  if (filters.season) query = query.eq('season', filters.season);
  const { data, error } = await query.order('tier').order('sell_price');
  if (error) throw new ServiceUnavailableError('Inventory unavailable. Please try again later.');
  return validateTyres(data);
}

export async function getTyreById(id: string): Promise<Tyre | null> {
  const { data, error } = await createServiceClient().from('tyre_inventory').select('*').eq('id', id).maybeSingle();
  if (error) throw new ServiceUnavailableError();
  return data ? validateTyres([data])[0] : null;
}

export async function getAllTyresAdmin(): Promise<Tyre[]> {
  const { data, error } = await createServiceClient().from('tyre_inventory').select('*').order('brand');
  if (error) throw new ServiceUnavailableError();
  return validateTyres(data);
}

export async function updateTyreStock(id: string, stock: number): Promise<boolean> {
  if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('Invalid stock.');
  const { data, error } = await createServiceClient().from('tyre_inventory').update({ stock }).eq('id', id).select('id').single();
  if (error || !data) throw new ServiceUnavailableError('Stock change could not be confirmed.');
  return true;
}

export async function updateTyrePrice(id: string, sellPrice: number): Promise<boolean> {
  if (!Number.isSafeInteger(sellPrice) || sellPrice <= 0) throw new Error('Invalid price.');
  const { data, error } = await createServiceClient().from('tyre_inventory').update({ sell_price: sellPrice }).eq('id', id).select('id').single();
  if (error || !data) throw new ServiceUnavailableError('Price change could not be confirmed.');
  return true;
}

export async function createTyre(input: Omit<Tyre, 'id' | 'created_at'>): Promise<Tyre> {
  const { data, error } = await createServiceClient().from('tyre_inventory').insert(input).select('*').single();
  if (error || !data) throw new ServiceUnavailableError('Tyre creation could not be confirmed.');
  return validateTyres([data])[0];
}

const slotSchema = z.object({
  id: z.string().min(1), slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/),
  max_bookings: z.number().int().positive().safe(), active: z.literal(true),
}).passthrough();

export async function getSlots(fromDate?: string, toDate?: string): Promise<SlotWithAvailability[]> {
  const db = createServiceClient();
  let query = db.from('booking_slots').select('*').eq('active', true)
    .gte('slot_date', fromDate ?? new Date().toISOString().slice(0, 10));
  if (toDate) query = query.lte('slot_date', toDate);
  const { data, error } = await query.order('slot_date').order('start_time');
  const parsed = z.array(slotSchema).safeParse(data);
  if (error || !parsed.success) throw new ServiceUnavailableError('Fitting availability unavailable.');
  const slots = parsed.data;
  if (!slots.length) return [];
  const ids = slots.map((s) => s.id);
  const [bookings, holds] = await Promise.all([
    db.from('bookings').select('slot_id').in('slot_id', ids)
      .not('status', 'in', '(cancelled,refunded,payment_failed,pending_payment)'),
    db.from('slot_holds').select('slot_id').in('slot_id', ids).gt('expires_at', new Date().toISOString()),
  ]);
  if (bookings.error || holds.error || !bookings.data || !holds.data) throw new ServiceUnavailableError('Fitting availability unavailable.');
  return slots.map((slot) => {
    if (!Number.isSafeInteger(slot.max_bookings) || slot.max_bookings < 1) throw new ServiceUnavailableError();
    const occupied = bookings.data.filter((b) => b.slot_id === slot.id).length;
    const reserved = holds.data.filter((h) => h.slot_id === slot.id).length;
    const remaining = Math.max(0, slot.max_bookings - occupied - reserved);
    return { ...slot, remaining, available: remaining > 0 } as SlotWithAvailability;
  });
}

export async function createSlotHold(slotId: string, sessionToken: string, minutes = 15): Promise<SlotHold> {
  const db = createServiceClient();
  const { data, error } = await db.rpc('create_slot_hold', {
    p_slot_id: slotId, p_session_token: sessionToken, p_minutes: minutes,
  });
  const result = Array.isArray(data) && data.length === 1 ? data[0] : data;
  if (error || !result?.hold_id) throw new ServiceUnavailableError('That fitting time could not be reserved. Please choose another.');
  // Require a persisted row owned by this session, not only an RPC envelope.
  const hold = await db.from('slot_holds').select('id,slot_id,expires_at')
    .eq('id', result.hold_id).eq('slot_id', slotId).eq('session_token', sessionToken)
    .gt('expires_at', new Date().toISOString()).single();
  if (hold.error || !hold.data || hold.data.id !== result.hold_id || hold.data.slot_id !== slotId
    || !Number.isFinite(Date.parse(hold.data.expires_at)) || Date.parse(hold.data.expires_at) <= Date.now()) throw new ServiceUnavailableError('That fitting time could not be reserved. Please choose another.');
  return { hold_id: hold.data.id, slot_id: hold.data.slot_id, expires_at: hold.data.expires_at };
}

export async function releaseSlotHold(sessionToken: string, slotId?: string): Promise<boolean> {
  let query = createServiceClient().from('slot_holds').delete().eq('session_token', sessionToken);
  if (slotId) query = query.eq('slot_id', slotId);
  const { error } = await query;
  if (error) throw new ServiceUnavailableError('Hold release could not be confirmed.');
  return true;
}

export async function isHoldValid(sessionToken: string, slotId: string): Promise<boolean> {
  const { data, error } = await createServiceClient().from('slot_holds').select('id').eq('slot_id', slotId)
    .eq('session_token', sessionToken).gt('expires_at', new Date().toISOString()).limit(1);
  if (error || !data) throw new ServiceUnavailableError();
  return data.length > 0;
}

const bookingSelect = '*, customer:customers(*), slot:booking_slots(*), items:booking_items(*)';
async function findBooking(column: string, value: string): Promise<BookingWithDetails | null> {
  const { data, error } = await createServiceClient().from('bookings').select(bookingSelect).eq(column, value).maybeSingle();
  if (error) throw new ServiceUnavailableError('Booking service unavailable. Please try again later.');
  return data as unknown as BookingWithDetails | null;
}
export const getBookingByRef = (ref: string) => findBooking('booking_ref', ref);
export const getBookingByToken = (token: string) => findBooking('manage_token', token);
export const getBookingById = (id: string) => findBooking('id', id);

export async function getAllBookings(filters: { status?: string; query?: string } = {}): Promise<BookingWithDetails[]> {
  let query = createServiceClient().from('bookings').select(bookingSelect).order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error || !data) throw new ServiceUnavailableError();
  const bookings = data as unknown as BookingWithDetails[];
  if (!filters.query) return bookings;
  const needle = filters.query.toLowerCase();
  return bookings.filter((b) => [b.booking_ref, b.vehicle_reg, b.customer?.name, b.customer?.email]
    .some((value) => value?.toLowerCase().includes(needle)));
}

const settingsSchema = z.object({
  deposit_mode: z.enum(['fixed', 'percent']), deposit_fixed: z.number().int().nonnegative().safe(),
  deposit_percent: z.number().min(0).max(100), fitting_fee: z.number().int().nonnegative().safe(),
  job_duration_mins: z.number().int().positive(), cancellation_policy: z.string(),
  business_phone: z.string().nullable(),
});
export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await createServiceClient().from('app_settings').select('*').eq('id', 1).single();
  const parsed = settingsSchema.safeParse(data);
  if (error || !parsed.success) throw new ServiceUnavailableError('Pricing unavailable. Cannot continue.');
  return parsed.data;
}

export async function getFitters(): Promise<Array<{ id: string; name: string; phone: string | null; active: boolean }>> {
  const { data, error } = await createServiceClient().from('fitters').select('id,name,phone,active').eq('active', true);
  if (error || !data) throw new ServiceUnavailableError();
  return data;
}

export async function recordAudit(actor: string, action: string, entity: string, entityId?: string, metadata?: Record<string, unknown>): Promise<void> {
  const { error } = await createServiceClient().from('audit_log').insert({
    actor, action, entity, entity_id: entityId ?? null, metadata: metadata ?? {},
  });
  if (error) throw new ServiceUnavailableError('Audit persistence could not be confirmed.');
}
