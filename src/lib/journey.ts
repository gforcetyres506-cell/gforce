import { z } from 'zod';
import { tyreSizeSchema } from './validation';

export function validBookingEntry(tyreId: string | null, width: string | null, profile: string | null, rim: string | null): boolean {
  if (!tyreId?.trim() || !width || !profile || !rim) return false;
  return tyreSizeSchema.safeParse({ width: Number(width), profile: Number(profile), rim: Number(rim) }).success;
}

const money = z.number().int().nonnegative().safe();
export const quoteSchema = z.object({
  lines: z.array(z.object({ tyre_id: z.string(), label: z.string(), quantity: z.number().int().positive(),
    unit_price: money, line_total: money })).min(1),
  tyres_total: money, fitting_fee: money, callout_charge: money,
  total_amount: money.positive(), deposit_amount: money, balance_due: money,
}).refine((quote) => quote.total_amount === quote.tyres_total + quote.fitting_fee + quote.callout_charge
  && quote.balance_due === quote.total_amount - quote.deposit_amount
  && quote.tyres_total === quote.lines.reduce((sum, line) => sum + line.line_total, 0)
  && quote.lines.every((line) => line.line_total === line.quantity * line.unit_price));
