import 'server-only';
import { z } from 'zod';
import type { BookingWithDetails } from '@/types';
import { ServiceUnavailableError } from './service-error';

// Aliases adapt the existing UI. Every stored name belongs to the migrations.
export const BOOKING_SELECT = 'id,booking_ref:reference,manage_token,customer_id,slot_id,fitter_id,vehicle_reg:registration,vehicle_make,vehicle_model,vehicle_derivative,fitting_address,fitting_postcode:postcode,customer_notes,status,tyres_total:subtotal_pence,fitting_fee:fitting_fee_pence,callout_charge:callout_fee_pence,total_amount:total_pence,deposit_amount:deposit_pence,balance_due:balance_pence,created_at,updated_at,customer:customers(id,first_name,last_name,email,phone,created_at),slot:booking_slots(id,slot_date:date,start_time:start_at,end_time:end_at,max_bookings:capacity,active),items:booking_items(id,booking_id,tyre_id:tyre_product_id,brand_snapshot,model_snapshot,size_snapshot,quantity,unit_price:unit_price_pence,line_total:line_total_pence),payments(provider,type,status,stripe_payment_intent_id,succeeded_at)';
const money = z.number().int().nonnegative().safe();
const nullableText = z.string().nullable();
const schema = z.object({
  id: z.string(), booking_ref: z.string(), manage_token: z.string(), customer_id: nullableText, slot_id: nullableText, fitter_id: nullableText,
  vehicle_reg: nullableText, vehicle_make: nullableText, vehicle_model: nullableText, vehicle_derivative: nullableText,
  fitting_address: z.string(), fitting_postcode: z.string(), customer_notes: nullableText,
  status: z.enum(['pending_payment', 'confirmed', 'tyres_reserved', 'fitter_assigned', 'en_route', 'completed', 'cancelled', 'refunded', 'payment_failed']),
  tyres_total: money, fitting_fee: money, callout_charge: money, total_amount: money, deposit_amount: money, balance_due: money,
  created_at: z.string(), updated_at: z.string(),
  customer: z.object({ id: z.string(), first_name: z.string(), last_name: z.string(), email: z.string(), phone: z.string(), created_at: z.string() }).nullable(),
  slot: z.object({ id: z.string(), slot_date: z.string(), start_time: z.string(), end_time: z.string(), max_bookings: z.number().int().positive(), active: z.boolean() }).nullable(),
  items: z.array(z.object({ id: z.string(), booking_id: z.string(), tyre_id: nullableText, brand_snapshot: z.string(), model_snapshot: z.string(), size_snapshot: z.string(), quantity: z.number().int().positive(), unit_price: money, line_total: money })),
  payments: z.array(z.object({ provider: z.string(), type: z.string(), status: z.string(), stripe_payment_intent_id: nullableText, succeeded_at: nullableText })),
});
export function mapBooking(data: unknown): BookingWithDetails {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ServiceUnavailableError('Booking data unavailable.');
  const { customer, items, payments, ...booking } = parsed.data;
  const receipt = payments.find((p) => p.provider === 'stripe' && p.type === 'deposit' && p.status === 'succeeded'
    && /^pi_[A-Za-z0-9]+$/.test(p.stripe_payment_intent_id ?? '') && p.succeeded_at && Number.isFinite(Date.parse(p.succeeded_at)));
  return { ...booking, admin_notes: null, stripe_charge_id: null,
    stripe_payment_intent_id: receipt?.stripe_payment_intent_id ?? null, deposit_paid_at: receipt?.succeeded_at ?? null,
    customer: customer ? { id: customer.id, name: [customer.first_name, customer.last_name].join(' '), email: customer.email,
      phone: customer.phone, created_at: customer.created_at, address_line1: null, address_line2: null, city: null, postcode: null } : null,
    items: items.map(({ brand_snapshot, model_snapshot, size_snapshot, ...item }) => ({ ...item, tyre_label: [brand_snapshot, model_snapshot, size_snapshot].join(' ') })),
  };
}
