import { createServiceClient } from './supabase';
import { ServiceUnavailableError } from './service-error';

/** Database errors cannot masquerade as a successful rate-limit check. */
export async function checkRateLimit(key: string, maxHits: number, windowMinutes: number): Promise<{ allowed: boolean; remaining: number }> {
  const db = createServiceClient();
  const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const result = await db.from('rate_limits').select('id,hits,window_start').eq('bucket_key', key)
    .gte('window_start', windowStart).order('window_start', { ascending: false }).limit(1);
  if (result.error || !result.data) throw new ServiceUnavailableError();
  const current = result.data[0];
  if (!current) {
    const { error } = await db.from('rate_limits').insert({ bucket_key: key, hits: 1 });
    if (error) throw new ServiceUnavailableError();
    return { allowed: true, remaining: maxHits - 1 };
  }
  if (!Number.isSafeInteger(current.hits) || current.hits < 0) throw new ServiceUnavailableError();
  if (current.hits >= maxHits) return { allowed: false, remaining: 0 };
  const { data, error } = await db.from('rate_limits').update({ hits: current.hits + 1 }).eq('id', current.id)
    .eq('hits', current.hits).select('id').single();
  if (error || !data) throw new ServiceUnavailableError();
  return { allowed: true, remaining: maxHits - current.hits - 1 };
}
export function getClientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}
