import { z } from 'zod';

export const bankDetailsSchema = z.object({
  bank_account_name: z.string().trim().min(1).max(120), bank_name: z.string().trim().min(1).max(120),
  sort_code: z.string().regex(/^\d{6}$/), account_number: z.string().regex(/^\d{8}$/),
});
export const bankSettingsSchema = bankDetailsSchema.extend({
  bank_payment_window_minutes: z.number().int().min(1).max(10080),
}).strict();
export type BankDetails = z.infer<typeof bankDetailsSchema>;
export interface BankPayment {
  provider: 'manual'; payment_method: 'bank_transfer'; status: 'pending' | 'received' | 'refunded' | 'cancelled';
  amount_pence: number; currency: 'gbp'; reference: string; bank_details: BankDetails;
  paid_at: string | null; verified: boolean;
}
export const bankReservationCopy = 'Your fitting is reserved while we wait for payment. Use your booking reference when making the transfer. Your booking is confirmed after G Force verifies receipt.';
export function paymentInstructions(payment: BankPayment, expiresAt: string): string {
  const b = payment.bank_details;
  return `${bankReservationCopy}\nReference: ${payment.reference}\nAmount due: £${(payment.amount_pence / 100).toFixed(2)}\nBank name: ${b.bank_name}\nAccount name: ${b.bank_account_name}\nSort code: ${b.sort_code.match(/.{2}/g)?.join('-')}\nAccount number: ${b.account_number}\nPayment reference: ${payment.reference}\nExpiry time: ${new Date(expiresAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })} (UK time)`;
}
