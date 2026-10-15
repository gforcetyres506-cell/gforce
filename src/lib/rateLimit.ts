import { createServiceClient } from './supabase';
import { ServiceUnavailableError } from './service-error';

/** Database errors cannot masquerade as a successful rate-limit check. */
export async function checkRateLimit(key: string, maxHits: number, windowMinutes: number): Promise<{ allowed: boolean; remaining: number }> {
  const { data, error } = await createServiceClient().rpc('consume_rate_limit', {
    p_bucket_key: key, p_max_hits: maxHits, p_window_minutes: windowMinutes,
  });
  const result = Array.isArray(data) && data.length === 1 ? data[0] : null;
  if (error || !result || typeof result.allowed !== 'boolean'
    || !Number.isSafeInteger(result.remaining) || result.remaining < 0) throw new ServiceUnavailableError();
  return result;
}
export function getClientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}
