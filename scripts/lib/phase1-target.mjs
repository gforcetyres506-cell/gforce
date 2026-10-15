import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function phase1Target(env = process.env, databaseRequired = false) {
  const required = (name) => { const value = env[name]?.trim(); assert(value, `${name} is required`); return value; };
  const projectRef = required('PHASE1_DISPOSABLE_PROJECT_REF');
  assert.match(projectRef, /^[a-z0-9]{20}$/, 'Invalid disposable project reference');
  assert.equal(env.PHASE1_CONFIRM_DISPOSABLE, 'I_CONFIRM_THIS_PROJECT_IS_DISPOSABLE', 'Disposable reset authorization is absent');
  const url = new URL(required('NEXT_PUBLIC_SUPABASE_URL'));
  assert(url.protocol === 'https:' && url.hostname === `${projectRef}.supabase.co`
    && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash && !url.port,
  'Supabase URL does not identify the authorized project');
  const app = new URL(required('PHASE1_APP_URL'));
  assert((app.protocol === 'https:' || (app.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(app.hostname)))
    && app.pathname === '/' && !app.username && !app.password && !app.search && !app.hash, 'Invalid acceptance application origin');
  const anonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
  assert.notEqual(anonKey, serviceKey, 'Public and privileged keys must differ');
  assert(!env.SUPABASE_SERVICE_KEY, 'Legacy SUPABASE_SERVICE_KEY is forbidden');
  const token = required('PHASE1_ACCEPTANCE_TOKEN');
  assert(token.length >= 32, 'Acceptance token must contain at least 32 characters');
  let databaseUrl;
  if (databaseRequired) {
    databaseUrl = new URL(required('PHASE1_DATABASE_URL'));
    const direct = databaseUrl.hostname === `db.${projectRef}.supabase.co` && databaseUrl.username === 'postgres';
    const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(databaseUrl.hostname)
      && decodeURIComponent(databaseUrl.username) === `postgres.${projectRef}`;
    assert(['postgres:', 'postgresql:'].includes(databaseUrl.protocol) && (direct || pooler)
      && (!databaseUrl.port || databaseUrl.port === '5432') && databaseUrl.pathname === '/postgres'
      && databaseUrl.password && !databaseUrl.hash, 'Database host/user does not identify the authorized disposable project');
    // pg connection-string ssl options can override TLS settings. Supply TLS
    // separately and always verify its certificate and hostname.
    for (const key of [...databaseUrl.searchParams.keys()]) {
      assert(['sslmode', 'application_name'].includes(key), 'Unsupported database connection option');
      if (key === 'sslmode') assert(['require', 'verify-full'].includes(databaseUrl.searchParams.get(key)), 'TLS is required');
      databaseUrl.searchParams.delete(key);
    }
  }
  return { projectRef, url: url.origin, appUrl: app.origin, anonKey, serviceKey, token, databaseUrl };
}

export async function attestApplication(target, request = fetch) {
  const nonce = randomBytes(32).toString('hex');
  const response = await request(`${target.appUrl}/api/admin/acceptance-target?nonce=${nonce}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, 'Application target attestation failed before mutation');
  const body = await response.json();
  const fingerprint = createHash('sha256').update(`${target.url}\0${target.anonKey}\0${target.projectRef}`).digest('hex');
  assert(body.ok === true && body.targetFingerprint === fingerprint && /^[a-f0-9]{64}$/.test(body.proof ?? ''), 'Application target mismatch');
  const expected = createHmac('sha256', target.token).update(`${nonce}\0${fingerprint}\0${target.appUrl}`).digest();
  const received = Buffer.from(body.proof, 'hex');
  assert(received.length === expected.length && timingSafeEqual(received, expected), 'Application target proof mismatch');
  return fingerprint;
}
