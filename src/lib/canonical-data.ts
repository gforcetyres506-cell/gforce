import 'server-only';
import { z } from 'zod';
import { ServiceUnavailableError } from './service-error';
import type { Tyre, AppSettings } from '@/types';

// Public projections never select inventory costs or supplier details.
export const CATALOGUE_SELECT = 'id,sku,brand,model,width,profile,rim,load_index,speed_rating,run_flat,extra_load,season,tier,wet_grip_rating,fuel_efficiency_rating,noise_db,active,created_at,inventory(stock_qty,reserved_qty,selling_price_pence)';
const inventorySchema = z.object({
  stock_qty: z.number().int().nonnegative().safe(),
  reserved_qty: z.number().int().nonnegative().safe(),
  selling_price_pence: z.number().int().positive().safe(),
}).refine((v) => v.reserved_qty <= v.stock_qty);
const productSchema = z.object({
  id: z.string().min(1), sku: z.string().min(1), brand: z.string().min(1), model: z.string().min(1),
  width: z.number().int().min(115).max(355), profile: z.number().int().min(20).max(85), rim: z.number().int().min(12).max(24),
  load_index: z.string().nullable(), speed_rating: z.string().nullable(), run_flat: z.boolean(), extra_load: z.boolean(),
  season: z.enum(['summer', 'all-season', 'winter']), tier: z.enum(['budget', 'standard', 'premium']),
  wet_grip_rating: z.string().nullable(), fuel_efficiency_rating: z.string().nullable(), noise_db: z.number().nullable(),
  active: z.boolean(), created_at: z.string(),
  inventory: z.union([inventorySchema, z.array(inventorySchema).length(1).transform((rows) => rows[0])]),
});
export function mapProducts(data: unknown): Tyre[] {
  const parsed = z.array(productSchema).safeParse(data);
  if (!parsed.success) throw new ServiceUnavailableError('Inventory unavailable. Please try again later.');
  return parsed.data.map((p) => ({
    id: p.id, sku: p.sku, brand: p.brand, model: p.model, width: p.width, profile: p.profile, rim: p.rim,
    load_index: p.load_index, speed_rating: p.speed_rating, is_run_flat: p.run_flat, is_xl: p.extra_load,
    season: p.season, tier: p.tier, wet_grip: p.wet_grip_rating, fuel_economy: p.fuel_efficiency_rating,
    noise_db: p.noise_db, active: p.active, created_at: p.created_at,
    sell_price: p.inventory.selling_price_pence, stock: p.inventory.stock_qty - p.inventory.reserved_qty,
  }));
}

const settingsSchema = z.object({
  pricing_configured: z.literal(true), deposit_mode: z.enum(['fixed', 'percent']),
  deposit_value: z.number().int().nonnegative().safe(), fitting_fee_pence: z.number().int().nonnegative().safe(),
  job_duration_minutes: z.number().int().positive(), cancellation_policy: z.string().trim().min(1), phone: z.string().nullable(),
}).refine((v) => v.deposit_mode !== 'percent' || v.deposit_value <= 100);
export function mapSettings(data: unknown): AppSettings {
  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) throw new ServiceUnavailableError('Pricing unavailable. Cannot continue.');
  const v = parsed.data;
  return { deposit_mode: v.deposit_mode, deposit_fixed: v.deposit_mode === 'fixed' ? v.deposit_value : 0,
    deposit_percent: v.deposit_mode === 'percent' ? v.deposit_value : 0, fitting_fee: v.fitting_fee_pence,
    job_duration_mins: v.job_duration_minutes, cancellation_policy: v.cancellation_policy, business_phone: v.phone };
}
