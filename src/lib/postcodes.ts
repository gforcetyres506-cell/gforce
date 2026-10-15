import { createServiceClient } from './supabase';
import { normalisePostcode } from './utils';
import { ServiceUnavailableError } from './service-error';
import { ukPostcodeSchema } from './validation';
import { z } from 'zod';
import type { CoverageResult } from '@/types';

export const outwardCodeSchema = z.string().regex(/^(?:[A-Z]{1,2}[0-9][A-Z0-9]?|GIR)$/);
export async function resolvePostcode(postcode: string): Promise<{ postcode: string; outward: string } | null> {
  if (!ukPostcodeSchema.safeParse(postcode).success) return null;
  try {
    const res = await fetch('https://api.postcodes.io/postcodes/' + encodeURIComponent(normalisePostcode(postcode)),
      { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error();
    const parsed = z.object({ status: z.literal(200), result: z.object({
      postcode: ukPostcodeSchema, outcode: outwardCodeSchema,
    }) }).safeParse(await res.json());
    if (!parsed.success) throw new Error();
    const clean = normalisePostcode(parsed.data.result.postcode);
    if (clean !== normalisePostcode(postcode) || clean.slice(0, -3) !== parsed.data.result.outcode) throw new Error();
    return { postcode: clean.slice(0, -3) + ' ' + clean.slice(-3), outward: parsed.data.result.outcode };
  } catch { throw new ServiceUnavailableError('Postcode verification unavailable. Please try again.'); }
}
export async function validatePostcode(postcode: string): Promise<boolean> {
  return (await resolvePostcode(postcode)) !== null;
}
const zoneSchema = z.object({
  id: z.string().min(1), postcode_prefix: outwardCodeSchema,
  zone_name: z.string().trim().min(1), callout_charge: z.number().int().nonnegative().safe(),
  priority: z.number().int().nonnegative().safe(), active: z.literal(true),
});
/** Coverage is an exact outward-code match in owner-controlled storage. */
export async function checkCoverage(postcode: string): Promise<CoverageResult> {
  if (!ukPostcodeSchema.safeParse(postcode).success) return { covered: false, message: 'Enter a full UK postcode.' };
  const outward = normalisePostcode(postcode).slice(0, -3);
  const { data, error } = await createServiceClient().from('service_zones')
    .select('id,postcode_prefix,zone_name:name,callout_charge:callout_fee_pence,priority,active')
    .eq('active', true).eq('postcode_prefix', outward).order('priority', { ascending: true });
  const parsed = z.array(zoneSchema).safeParse(data);
  if (error || !parsed.success) throw new ServiceUnavailableError('Fitting area verification unavailable.');
  const zone = parsed.data.filter((z) => z.postcode_prefix === outward).sort((a, b) => a.priority - b.priority)[0];
  if (!zone) return { covered: false, message: 'This postcode is outside our current fitting area.' };
  return { covered: true, zone, message: zone.callout_charge > 0
    ? 'This postcode is covered. A location charge applies.' : 'This postcode is covered. No location charge.' };
}
