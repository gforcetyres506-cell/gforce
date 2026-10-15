import { z } from 'zod';

// All business values are required. Explicit null means the owner has no value.
const money = z.number().int().nonnegative().max(2147483647);
const text = z.string().trim().min(1).max(200);
export const ownerZoneSchema = z.object({
  postcode_prefix: z.string().trim().transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^(?:[A-Z]{1,2}[0-9][A-Z0-9]?|GIR)$/)),
  name: text, callout_fee_pence: money, priority: money, active: z.boolean(),
}).strict();
export const ownerProductSchema = z.object({
  sku: text, brand: text, model: text,
  width: z.number().int().min(115).max(355), profile: z.number().int().min(20).max(85),
  rim: z.number().int().min(12).max(24),
  load_index: text.nullable(), speed_rating: text.nullable(),
  run_flat: z.boolean(), extra_load: z.boolean(),
  season: z.enum(['summer', 'all-season', 'winter']), tier: z.enum(['budget', 'standard', 'premium']),
  wet_grip_rating: z.enum(['A','B','C','D','E']).nullable(),
  fuel_efficiency_rating: z.enum(['A','B','C','D','E']).nullable(),
  noise_db: z.number().int().min(1).max(150).nullable(),
  image_url: z.string().url().max(2048).refine((s) => s.startsWith('https://')).nullable(),
  active: z.boolean(),
  inventory: z.object({
    selling_price_pence: money.positive(), cost_price_pence: money,
    stock_qty: money, reserved_qty: money, supplier_sku: text.nullable(), low_stock_threshold: money,
  }).strict().refine((v) => v.reserved_qty <= v.stock_qty, 'Reserved stock exceeds physical stock'),
}).strict();
export const ownerImportSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('zones'), rows: z.array(ownerZoneSchema).min(1).max(500) }).strict(),
  z.object({ kind: z.literal('catalogue'), rows: z.array(ownerProductSchema).min(1).max(500) }).strict(),
]).superRefine((data, ctx) => {
  const keys = data.kind === 'zones' ? data.rows.map((r) => r.postcode_prefix) : data.rows.map((r) => r.sku);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate outward postcode or SKU in batch' });
});
