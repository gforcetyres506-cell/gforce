import { z } from 'zod';

const id = z.string().uuid();
const reason = z.string().trim().min(3).max(500);
const productFields = {
  sku: z.string().trim().min(1).max(80), brand: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(120),
  width: z.number().int().min(115).max(355), profile: z.number().int().min(20).max(85), rim: z.number().int().min(12).max(24),
  load_index: z.string().trim().max(12).default(''), speed_rating: z.string().trim().max(8).default(''),
  run_flat: z.boolean(), extra_load: z.boolean(), season: z.enum(['summer','all-season','winter']),
  tier: z.enum(['budget','standard','premium']), image_url: z.union([z.string().url().startsWith('https://'),z.literal('')]).default(''),
};
export const productImportRowSchema = z.object({ ...productFields,
  stock_qty: z.number().int().nonnegative(), cost_price_pence: z.number().int().nonnegative(),
  selling_price_pence: z.number().int().positive(), supplier_sku: z.string().trim().max(80).default(''),
  low_stock_threshold: z.number().int().nonnegative(),
}).strict();

export const adminActionSchema = z.discriminatedUnion('action', [
  z.object({ action:z.literal('product.save'), payload:z.object({ id:id.optional(), ...productFields,
    stock_qty:z.number().int().nonnegative().optional(),cost_price_pence:z.number().int().nonnegative().optional(),
    selling_price_pence:z.number().int().positive().optional(),supplier_sku:z.string().trim().max(80).default(''),
    low_stock_threshold:z.number().int().nonnegative().optional() }).strict().superRefine((v,c)=>{
      if (!v.id) for (const k of ['stock_qty','cost_price_pence','selling_price_pence','low_stock_threshold'] as const)
        if (v[k]===undefined) c.addIssue({code:z.ZodIssueCode.custom,path:[k],message:'Required for a new product'});
    }) }),
  z.object({ action:z.literal('product.archive'), payload:z.object({ id }).strict() }),
  z.object({ action:z.enum(['inventory.adjust','inventory.cycle_count']), payload:z.object({ tyre_product_id:id,
    stock_qty:z.number().int().nonnegative().optional(),cost_price_pence:z.number().int().nonnegative().optional(),
    selling_price_pence:z.number().int().positive().optional(),supplier_sku:z.string().trim().max(80).optional(),
    low_stock_threshold:z.number().int().nonnegative().optional(),reason }).strict() }),
  z.object({ action:z.literal('zone.save'), payload:z.object({ id:id.optional(),name:z.string().trim().min(1).max(120),
    postcode_prefix:z.string().trim().regex(/^(?:[A-Za-z]{1,2}\d[A-Za-z\d]?|GIR)$/),callout_fee_pence:z.number().int().nonnegative(),
    priority:z.number().int().nonnegative(),active:z.boolean() }).strict() }),
  z.object({ action:z.literal('zone.archive'), payload:z.object({ id }).strict() }),
  z.object({ action:z.literal('fitter.save'), payload:z.object({ id:id.optional(),name:z.string().trim().min(1).max(120),
    phone:z.string().trim().max(30),van_name:z.string().trim().max(80),active:z.boolean() }).strict() }),
  z.object({ action:z.literal('fitter.archive'), payload:z.object({ id }).strict() }),
  z.object({ action:z.literal('slot.rule.save'), payload:z.object({ id:id.optional(),day_of_week:z.number().int().min(0).max(6),
    start_time:z.string().regex(/^\d{2}:\d{2}$/),end_time:z.string().regex(/^\d{2}:\d{2}$/),slot_duration_minutes:z.number().int().min(5).max(480),
    capacity:z.number().int().min(1).max(100),active:z.boolean() }).strict() }),
  z.object({ action:z.literal('slot.generate'), payload:z.object({ from_date:z.string().date(),to_date:z.string().date() }).strict() }),
  z.object({ action:z.literal('slot.capacity'), payload:z.object({ id,capacity:z.number().int().min(1).max(100) }).strict() }),
  z.object({ action:z.literal('slot.block'), payload:z.object({ date:z.string().date(),reason }).strict() }),
  z.object({ action:z.literal('slot.unblock'), payload:z.object({ date:z.string().date() }).strict() }),
  z.object({ action:z.literal('slot.special.save'), payload:z.object({ date:z.string().date(),start_time:z.string().regex(/^\d{2}:\d{2}$/),
    end_time:z.string().regex(/^\d{2}:\d{2}$/),slot_duration_minutes:z.number().int().min(5).max(480),capacity:z.number().int().min(1).max(100),
    active:z.boolean(),note:z.string().trim().max(500) }).strict() }),
  z.object({ action:z.literal('slot.special.delete'), payload:z.object({ id }).strict() }),
  z.object({ action:z.literal('settings.save'), payload:z.object({ phone:z.string().trim().max(30),email:z.union([z.string().trim().email(),z.literal('')]),
    whatsapp:z.string().trim().max(30),fitting_fee_pence:z.number().int().nonnegative(),booking_horizon_days:z.number().int().min(1).max(365),
    vat_registered:z.boolean(),vat_number:z.string().trim().max(30),vat_rate_bps:z.number().int().min(0).max(10000),
    same_day_enabled:z.boolean(),same_day_cutoff:z.union([z.string().regex(/^\d{2}:\d{2}$/),z.literal('')]),
    cancellation_notice_hours:z.number().int().min(0).max(8760),cancellation_policy:z.string().trim().min(1).max(5000),
    terms_and_conditions:z.string().trim().max(20000),privacy_policy:z.string().trim().max(20000) }).strict().superRefine((v,c)=>{
      if(v.same_day_enabled&&!v.same_day_cutoff)c.addIssue({code:z.ZodIssueCode.custom,path:['same_day_cutoff'],message:'Required when same-day booking is enabled'});
    }) }),
  z.object({ action:z.literal('booking.assign_fitter'), payload:z.object({ booking_id:id,fitter_id:id,reason }).strict() }),
  z.object({ action:z.literal('booking.status'), payload:z.object({ booking_id:id,status:z.enum(['tyres_reserved','fitter_assigned','en_route','completed']),reason }).strict() }),
  z.object({ action:z.literal('booking.reschedule'), payload:z.object({ booking_id:id,slot_id:id,reason }).strict() }),
  z.object({ action:z.literal('booking.cancel'), payload:z.object({ booking_id:id,reason }).strict() }),
  z.object({ action:z.literal('payment.refund'), payload:z.object({ booking_id:id,reason,
    refund_amount_pence:z.number().int().positive(),refund_reference:z.string().trim().min(2).max(120),refund_confirmed:z.literal(true) }).strict() }),
]);

export type AdminAction = z.infer<typeof adminActionSchema>;

export const accessSchema = z.discriminatedUnion('action', [
  z.object({ action:z.literal('access.provision'), email:z.string().trim().email().max(254),name:z.string().trim().min(1).max(120),role:z.enum(['owner','admin','viewer']) }).strict(),
  z.object({ action:z.literal('access.change'), user_id:id,role:z.enum(['owner','admin','viewer']),active:z.boolean() }).strict(),
]);

export function parseCsv(text:string): string[][] {
  const rows:string[][]=[]; let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const ch=text[i]; if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}
    else if(ch==='"')quoted=true;else if(ch===','){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=ch;}
  if(quoted) throw new Error('Unclosed quoted field'); if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);} return rows.filter(r=>r.some(v=>v.trim()));
}
