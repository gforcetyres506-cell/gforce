import { z } from 'zod';

export const reservationSchema = z.object({
  booking_id: z.string().uuid(), reference: z.string().min(1), manage_token: z.string().uuid(),
  status: z.enum(['AWAITING_BANK_PAYMENT', 'EXPIRED', 'CONFIRMED']), expires_at: z.string().datetime({ offset: true }),
  total_pence: z.number().int().positive(), deposit_pence: z.number().int().nonnegative(), balance_pence: z.number().int().nonnegative(),
}).refine((v) => v.deposit_pence + v.balance_pence === v.total_pence);
