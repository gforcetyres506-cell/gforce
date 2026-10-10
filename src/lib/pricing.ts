import { createServiceClient } from './supabase';
import { getSettings, validateTyres } from './db';
import { CATALOGUE_SELECT } from './canonical-data';
import { formatTyreSize } from './utils';
import { ServiceUnavailableError } from './service-error';
import type { CartLine, PriceBreakdown } from '@/types';

export class PricingError extends Error {
  constructor(public code: 'TYRE_NOT_FOUND' | 'OUT_OF_STOCK' | 'EMPTY_CART' | 'INVALID_CART', message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

/** Every amount comes from validated persistent inventory, settings and coverage. */
export async function calculatePrice(lines: CartLine[], calloutCharge: number): Promise<PriceBreakdown> {
  if (!lines.length) throw new PricingError('EMPTY_CART', 'No tyres selected.');
  if (!Number.isSafeInteger(calloutCharge) || calloutCharge < 0) throw new ServiceUnavailableError('Pricing unavailable. Cannot continue.');
  const quantities = new Map<string, number>();
  for (const line of lines) {
    if (!line.tyre_id || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 8) throw new PricingError('INVALID_CART', 'Check the selected tyres and quantities.');
    quantities.set(line.tyre_id, (quantities.get(line.tyre_id) ?? 0) + line.quantity);
  }
  const settings = await getSettings();
  const { data, error } = await createServiceClient().from('tyre_products').select(CATALOGUE_SELECT).in('id', [...quantities.keys()]).eq('active', true);
  if (error) throw new ServiceUnavailableError('Pricing unavailable. Cannot continue.');
  const tyres = validateTyres(data);
  const priced = [...quantities].map(([id, quantity]) => {
    const tyre = tyres.find((t) => t.id === id);
    if (!tyre) throw new PricingError('TYRE_NOT_FOUND', 'One of the selected tyres is no longer available.');
    if (tyre.stock < quantity) throw new PricingError('OUT_OF_STOCK', 'The requested tyre quantity is not available.');
    const line_total = tyre.sell_price * quantity;
    if (!Number.isSafeInteger(line_total)) throw new ServiceUnavailableError('Pricing unavailable. Cannot continue.');
    return { tyre_id: id, label: [tyre.brand, tyre.model, formatTyreSize(tyre)].join(' '), quantity, unit_price: tyre.sell_price, line_total };
  });
  const tyres_total = priced.reduce((sum, line) => sum + line.line_total, 0);
  const total_amount = tyres_total + settings.fitting_fee + calloutCharge;
  if (!Number.isSafeInteger(total_amount) || total_amount <= 0) throw new ServiceUnavailableError('Pricing unavailable. Cannot continue.');
  const deposit_amount = total_amount; // V1 collects the full total by bank transfer.
  return { lines: priced, tyres_total, fitting_fee: settings.fitting_fee, callout_charge: calloutCharge,
    total_amount, deposit_amount, balance_due: total_amount - deposit_amount };
}
