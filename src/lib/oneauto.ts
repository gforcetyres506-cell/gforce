import { normaliseReg } from './utils';
import { tyreSizeSchema, ukRegSchema } from './validation';
import type { VRMResult, VehicleTyreSpec } from '@/types';

type Row = Record<string, unknown>;
const row = (value: unknown): Row | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** Unknown, ambiguous and unavailable provider results always require manual size. */
export async function lookupVRM(rawReg: string): Promise<VRMResult | null> {
  const registration = normaliseReg(rawReg);
  const apiKey = process.env.ONEAUTO_API_KEY;
  if (!ukRegSchema.safeParse(registration).success || !apiKey) return null;
  const baseUrl = process.env.ONEAUTO_BASE_URL ?? 'https://api.oneautoapi.com';
  try {
    const res = await fetch(baseUrl + '/tyres?vrm=' + encodeURIComponent(registration), {
      headers: { apikey: apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000), cache: 'no-store',
    });
    if (!res.ok) return null;
    return normaliseOneAutoResponse(registration, await res.json());
  } catch {
    return null;
  }
}

export function normaliseOneAutoResponse(registration: string, raw: unknown): VRMResult | null {
  const root = row(raw);
  const data = row(root?.data);
  const vehicle = row(root?.vehicle) ?? row(data?.vehicle) ?? data ?? root;
  if (!root || !vehicle || root.success === false || data?.success === false) return null;
  for (const candidate of [root, data, vehicle]) {
    if (!candidate) continue;
    if (candidate.ambiguous === true || candidate.multipleMatches === true || candidate.status === 'ambiguous') return null;
    for (const key of ['matches', 'vehicles', 'alternatives', 'options']) {
      if (Array.isArray(candidate[key]) && (candidate[key] as unknown[]).length > 1) return null;
    }
  }
  const make = text(vehicle.make ?? vehicle.manufacturer);
  const model = text(vehicle.model ?? vehicle.range);
  if (!make || !model || /^(unknown|n\/a)$/i.test(make) || /^(unknown|n\/a)$/i.test(model)) return null;
  const providerReg = text(vehicle.registration ?? vehicle.vrm);
  if (providerReg && normaliseReg(providerReg) !== registration) return null;
  const list = root.tyres ?? data?.tyres ?? vehicle.tyres ?? (root.tyre ? [root.tyre] : []);
  if (!Array.isArray(list) || list.length < 1 || list.length > 2) return null;
  const entries = list.map(row);
  if (entries.some((entry) => !entry)) return null;
  const toSpec = (tyre: Row): VehicleTyreSpec | null => {
    const parsed = tyreSizeSchema.safeParse({
      width: Number(tyre.width ?? tyre.tyreWidth ?? tyre.section_width),
      profile: Number(tyre.aspectRatio ?? tyre.profile ?? tyre.aspect_ratio),
      rim: Number(tyre.rimSize ?? tyre.rim ?? tyre.rim_diameter),
    });
    if (!parsed.success) return null;
    const runFlat = tyre.isRunFlat ?? tyre.runFlat ?? tyre.run_flat;
    return { ...parsed.data,
      load_index: text(tyre.loadIndex ?? tyre.load_index),
      speed_rating: text(tyre.speedRating ?? tyre.speed_rating),
      ...(typeof runFlat === 'boolean' ? { is_run_flat: runFlat } : {}),
    };
  };
  // Two options without explicit axle labels could be alternative wheel sizes.
  // Never assume array order means front/rear.
  const axle = (entry: Row) => text(entry.axle ?? entry.position)?.toLowerCase();
  const frontRow = entries.length === 1
    ? ([undefined, 'front', 'all', 'both'].includes(axle(entries[0]!)) ? entries[0] : null)
    : entries.find((entry) => axle(entry!) === 'front');
  const rearRow = entries.length === 2 ? entries.find((entry) => axle(entry!) === 'rear') : undefined;
  if (!frontRow || (entries.length === 2 && !rearRow)) return null;
  const front = toSpec(frontRow);
  const rear = rearRow ? toSpec(rearRow) : undefined;
  if (!front || (rearRow && !rear)) return null;
  const isStaggered = !!rear && (front.width !== rear.width || front.profile !== rear.profile || front.rim !== rear.rim);
  return { registration, make, model, front, ...(isStaggered ? { rear: rear! } : {}),
    derivative: text(vehicle.derivative ?? vehicle.variant), isStaggered, source: 'oneauto' };
}
