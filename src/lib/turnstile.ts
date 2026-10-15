import 'server-only';

/** Server verification is mandatory in every runtime; no development bypass. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  let hostname: string;
  try { hostname = new URL(process.env.APP_URL ?? '').hostname; } catch { return false; }
  if (!secret || /^[123]x0{20,}/.test(secret) || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== 'unknown') body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body, signal: AbortSignal.timeout(5000), cache: 'no-store',
    });
    if (!res.ok) return false;
    const json = await res.json();
    return json.success === true && json.action === 'vrm_lookup' && json.hostname === hostname;
  } catch { return false; }
}
