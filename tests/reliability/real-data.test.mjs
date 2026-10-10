import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource, databaseDouble } from './loader.mjs';

const ok = (data) => ({ data, error: null });
const zone = { id: 'test-zone', postcode_prefix: 'E1', zone_name: 'Test only', callout_charge: 731, priority: 4, active: true };
test('coverage does not confuse E1 with E14', async () => {
  const db = databaseDouble(() => ok([zone]));
  const helper = loadSource('src/lib/postcodes.ts', { db });
  assert.equal((await helper.checkCoverage('E14 8PX')).covered, false);
  assert(db.calls[0].filters.some((f) => f[0] === 'eq' && f[1] === 'postcode_prefix' && f[2] === 'E14'));
});
test('coverage returns only supplied zone and fee with explicit priority', async () => {
  const db = databaseDouble(() => ok([{ ...zone, priority: 8, callout_charge: 902 }, zone]));
  const result = await loadSource('src/lib/postcodes.ts', { db }).checkCoverage('E1 6AN');
  assert.equal(result.covered, true); assert.equal(result.zone.callout_charge, 731);
});
test('inactive or malformed owner zone cannot become coverage', async () => {
  for (const row of [{ ...zone, active: false }, { ...zone, priority: undefined }, { ...zone, postcode_prefix: 'E*' }]) {
    await assert.rejects(loadSource('src/lib/postcodes.ts', { db: databaseDouble(() => ok([row])) }).checkCoverage('E1 6AN'));
  }
});
test('Postcodes.io validates and normalizes only', async () => {
  const helper = loadSource('src/lib/postcodes.ts', { fetch: async (url) => {
    assert(url.endsWith('/e148px') || url.endsWith('/E148PX'));
    return Response.json({ status: 200, result: { postcode: 'E14 8PX', outcode: 'E14' } });
  } });
  assert.deepEqual(await helper.resolvePostcode('e148px'), { postcode: 'E14 8PX', outward: 'E14' });
});
test('Postcodes.io 404 is invalid; errors, wrong postcode and schema never pass', async () => {
  assert.equal(await loadSource('src/lib/postcodes.ts', { fetch: async () => new Response('', { status: 404 }) }).resolvePostcode('E14 8PX'), null);
  for (const response of [new Response('', { status: 503 }), Response.json({ result: true }),
    Response.json({ status: 200, result: { postcode: 'E1 6AN', outcode: 'E1' } })]) {
    await assert.rejects(loadSource('src/lib/postcodes.ts', { fetch: async () => response }).resolvePostcode('E14 8PX'));
  }
});
const turnstileEnv = { TURNSTILE_SECRET_KEY: 'test-only-secret', APP_URL: 'https://test.example.invalid' };
for (const [name, body, status, expected] of [
  ['valid', { success: true, hostname: 'test.example.invalid', action: 'vrm_lookup' }, 200, true],
  ['replayed', { success: false, 'error-codes': ['timeout-or-duplicate'] }, 200, false],
  ['wrong host', { success: true, hostname: 'other.invalid', action: 'vrm_lookup' }, 200, false],
  ['wrong action', { success: true, hostname: 'test.example.invalid', action: 'login' }, 200, false],
  ['HTTP failure', { success: true, hostname: 'test.example.invalid', action: 'vrm_lookup' }, 503, false],
]) test('Turnstile: ' + name, async () => {
  const helper = loadSource('src/lib/turnstile.ts', { env: turnstileEnv, fetch: async (_url, init) => {
    assert.equal(init.body.get('response'), 'test-token'); assert(init.signal); return Response.json(body, { status });
  } });
  assert.equal(await helper.verifyTurnstile('test-token', 'unknown'), expected);
});
test('Turnstile never skips missing config, missing token, timeout or test secret', async () => {
  for (const env of [{}, { NODE_ENV: 'development' }, { ...turnstileEnv, TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' }]) {
    assert.equal(await loadSource('src/lib/turnstile.ts', { env }).verifyTurnstile('test', 'unknown'), false);
  }
  const helper = loadSource('src/lib/turnstile.ts', { env: turnstileEnv, fetch: async () => { throw Error('timeout'); } });
  assert.equal(await helper.verifyTurnstile(undefined, 'unknown'), false);
  assert.equal(await helper.verifyTurnstile('token', 'unknown'), false);
});
const vrmRequest = () => new Request('https://test.invalid/api/vrm/lookup', { method: 'POST',
  body: JSON.stringify({ registration: 'AB21ABC', postcode: 'E14 8PX', turnstileToken: 'test-token' }) });
function vrmRoute({ covered = true, valid = true, allowed = true, bot = true, vehicle = null, rateError = false } = {}) {
  const calls = [];
  const route = loadSource('src/app/api/vrm/lookup/route.ts', { env: { ONEAUTO_API_KEY: 'test-only' }, modules: {
    '@/lib/postcodes': {
      resolvePostcode: async () => { calls.push('postcode'); return valid ? { postcode: 'E14 8PX' } : null; },
      checkCoverage: async () => { calls.push('coverage'); return { covered, zone, message: 'Outside area' }; },
    },
    '@/lib/turnstile': { verifyTurnstile: async () => { calls.push('turnstile'); return bot; } },
    '@/lib/rateLimit': { getClientIp: () => 'test-ip', checkRateLimit: async (key) => {
      calls.push(key); if (rateError) throw Error('Database unavailable'); return { allowed }; } },
    '@/lib/oneauto': { lookupVRM: async () => { calls.push('provider'); return vehicle; } },
  } });
  return { route, calls };
}
test('VRM request revalidates postcode and coverage before any paid lookup', async () => {
  const { route, calls } = vrmRoute();
  assert.equal((await route.POST(vrmRequest())).status, 404);
  assert.deepEqual(calls, ['turnstile', 'vrm:test-ip', 'postcode', 'coverage', 'vrm:global', 'provider']);
});
for (const [name, options, status] of [
  ['uncovered', { covered: false }, 400], ['invalid postcode', { valid: false }, 400],
  ['bot rejected', { bot: false }, 403], ['rate limited', { allowed: false }, 429],
  ['limiter database failure', { rateError: true }, 503],
]) test('VRM blocks provider on ' + name, async () => {
  const { route, calls } = vrmRoute(options);
  assert.equal((await route.POST(vrmRequest())).status, status); assert(!calls.includes('provider'));
});
test('provider null requires manual tyre size', async () => {
  const { route } = vrmRoute(); const response = await route.POST(vrmRequest());
  assert.match((await response.json()).message, /sidewall/);
});
test('database limiter uses atomic RPC and fails closed on invalid response', async () => {
  const db = databaseDouble(() => { throw Error(); }, () => ok([{ allowed: false, remaining: 0 }]));
  const helper = loadSource('src/lib/rateLimit.ts', { db });
  assert.equal((await helper.checkRateLimit('vrm:test', 3, 10)).allowed, false);
  assert.equal(db.calls[0].rpc, 'consume_rate_limit');
  await assert.rejects(loadSource('src/lib/rateLimit.ts', { db: databaseDouble(() => ok([]), () => ok([])) }).checkRateLimit('x', 3, 10));
});
const ownerInput = { kind: 'zones', rows: [{ postcode_prefix: 'e1', name: 'Test only', callout_fee_pence: 0, priority: 1, active: true }] };
test('owner import requires explicit business fields and rejects duplicate zones', () => {
  const { ownerImportSchema } = loadSource('src/lib/owner-data.ts');
  assert.equal(ownerImportSchema.parse(ownerInput).rows[0].postcode_prefix, 'E1');
  assert.equal(ownerImportSchema.safeParse({ ...ownerInput, rows: [{ postcode_prefix: 'E1' }] }).success, false);
  assert.equal(ownerImportSchema.safeParse({ ...ownerInput, rows: [...ownerInput.rows, ...ownerInput.rows] }).success, false);
  assert.equal(ownerImportSchema.safeParse({ ...ownerInput, rows: [] }).success, false);
  assert.equal(ownerImportSchema.safeParse({ ...ownerInput, rows: [{ ...ownerInput.rows[0], active: 'true' }] }).success, false);
});
test('owner import binds verified actor and session, never browser actor fields', async () => {
  let input;
  const route = loadSource('src/app/api/admin/data/route.ts', { modules: {
    '@/lib/auth/admin': { requireAdmin: async (permission) => { assert.equal(permission, 'owner'); return { user: { id: 'verified-owner' }, sessionId: 'verified-session' }; },
      requireSameOrigin: () => {}, adminErrorResponse: () => Response.json({ ok: false }, { status: 503 }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async (name, args) => { assert.equal(name, 'owner_import_business_data'); input = args; return ok(1); } }) },
  } });
  const response = await route.POST(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(ownerInput) }));
  assert.equal(response.status, 200); assert.equal(input.p_actor_user_id, 'verified-owner'); assert.equal(input.p_session_id, 'verified-session');
});
test('empty public catalogue stays empty and projects no supplier or costs', async () => {
  const db = databaseDouble(() => ok([]));
  const route = loadSource('src/app/api/tyres/route.ts', { db });
  const response = await route.GET(new Request('https://test.invalid/api/tyres'));
  assert.deepEqual((await response.json()).data, []);
  const select = db.calls[0].filters.find((f) => f[0] === 'select')[1];
  assert(!select.includes('cost_price')); assert(!select.includes('supplier_sku')); assert(select.includes('image_url'));
});
