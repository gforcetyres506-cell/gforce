import type { Booking } from '@/types';

/** Display only what the persisted record supports; a status alone is insufficient. */
export function hasRecordedDeposit(booking: Booking): boolean {
  const p = booking.bank_payment;
  if (p) return p.provider === 'manual' && p.payment_method === 'bank_transfer' && p.status === 'received'
    && p.verified && !!p.paid_at && Number.isFinite(Date.parse(p.paid_at)) && p.amount_pence === booking.total_amount;
  return !!booking.deposit_paid_at && Number.isFinite(Date.parse(booking.deposit_paid_at))
    && /^pi_[a-zA-Z0-9]+$/.test(booking.stripe_payment_intent_id ?? '')
    && /^ch_[a-zA-Z0-9]+$/.test(booking.stripe_charge_id ?? '');
}

export function bookingHeading(booking: Booking): string {
  if (booking.status === 'AWAITING_BANK_PAYMENT') return 'Awaiting bank payment';
  if (booking.status === 'EXPIRED') return 'Booking expired';
  if (booking.status === 'cancelled') return 'Booking cancelled';
  if (booking.status === 'refunded') return 'Refund recorded';
  if (booking.status === 'payment_failed') return 'Payment failed';
  if (booking.status === 'pending_payment') return 'Payment pending';
  return hasRecordedDeposit(booking) ? 'Booking confirmed' : 'Payment confirmation unavailable';
}
