import { createServiceClient } from './supabase';
import { normalisePostcode } from './utils';
import { ServiceUnavailableError } from './service-error';
import { z } from 'zod';
import type { CoverageResult } from '@/types';

export async function validatePostcode(postcode: string): Promise<boolean> {
  try {
    const res = await fetch(
      'https://api.postcodes.io/postcodes/' + encodeURIComponent(postcode) + '/validate',
      { signal: AbortSignal.timeout(4000), cache: 'no-store' },
    );
    if (!res.ok) throw new ServiceUnavailableError();
    const json = await res.json();
    if (typeof json.result !== 'boolean') throw new ServiceUnavailableError();
    return json.result;
  } catch {
    throw new ServiceUnavailableError('Postcode verification unavailable. Please try again.');
  }
}

const zoneSchema = z.object({
  id: z.string().min(1), postcode_prefix: z.string().trim().min(1),
  zone_name: z.string().min(1), callout_charge: z.number().int().nonnegative().safe(), active: z.literal(true),
});
export async function checkCoverage(postcode: string): Promise<CoverageResult> {
  const clean = normalisePostcode(postcode);
  if (clean.length < 4) return { covered: false, message: 'Enter a full UK postcode.' };
  const { data, error } = await createServiceClient().from('service_zones').select('*').eq('active', true);
  const parsed = z.array(zoneSchema).safeParse(data);
  if (error || !parsed.success) throw new ServiceUnavailableError('Fitting area verification unavailable.');
  const zone = parsed.data
    .filter((z) => clean.startsWith(normalisePostcode(z.postcode_prefix)))
    .sort((a, b) => b.postcode_prefix.length - a.postcode_prefix.length)[0];
  if (!zone) return { covered: false, message: 'This postcode is outside our current fitting area.' };
  return { covered: true, zone, message: zone.callout_charge > 0
    ? 'This postcode is covered. A location charge applies.' : 'This postcode is covered. No location charge.' };
}
