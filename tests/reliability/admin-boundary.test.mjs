import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, createHmac } from 'node:crypto';
import { loadSource } from './loader.mjs';
import { phase1Target, attestApplication } from '../../scripts/lib/phase1-target.mjs';

function guards({ role = 'admin', active = true, session = true, profileError = null, sessionError = null, user = true, throwConfiguration = false } = {}) {
  const client = { auth: { getUser: async () => ({ data: { user: user ? { id: 'test-user' } : null }, error: null }) },
    rpc: async (name) => name === 'has_live_session' ? { data: session, error: sessionError }
      : { data: active ? [{ id: 'test-profile', user_id: 'test-user', name: 'Test only', role, active, session_id: 'test-session' }] : [], error: profileError } };
  return loadSource('src/lib/auth/admin.ts', { modules: {
    '@/lib/supabase/server': { createClient: async () => { if (throwConfiguration) throw Error('Unconfigured'); return client; } },
    'next/navigation': { redirect: (path) => { throw Error('redirect ' + path); }, forbidden: () => { throw Error('forbidden page'); } },
    'next/server': { NextResponse: { json: (body, options) => new Response(JSON.stringify(body), options) } },
  } });
}
for (const [role, allowed] of [['viewer', ['read']], ['admin', ['read', 'operate']], ['owner', ['read', 'operate', 'owner']]]) {
  for (const permission of ['read', 'operate', 'owner']) test(`${role} server permission: ${permission}`, async () => {
    const api = guards({ role });
    if (allowed.includes(permission)) assert.equal((await api.requireAdmin(permission)).profile.role, role);
    else await assert.rejects(api.requireAdmin(permission), { status: 403 });
  });
}
for (const [label, options, status] of [
  ['normal user', { role: 'normal' }, 403], ['inactive profile', { active: false }, 403],
  ['anonymous', { user: false }, 401], ['revoked session', { session: false }, 401],
  ['configuration missing', { throwConfiguration: true }, 503],
  ['session lookup failure', { sessionError: Error('Outage') }, 503],
  ['profile lookup failure', { profileError: Error('Outage') }, 503],
]) test(label + ' fails closed at protected server routes', async () => {
  await assert.rejects(guards(options).requireAdmin('read'), { status });
});
test('cookie mutations reject cross-site origins', () => {
  const api = guards();
  assert.throws(() => api.requireSameOrigin(new Request('https://example.com/api/admin/access', { headers: { origin: 'https://attacker.invalid' } })), { status: 403 });
  api.requireSameOrigin(new Request('https://example.com/api/admin/access', { headers: { origin: 'https://example.com' } }));
});

const ref = 'a'.repeat(20);
const env = { PHASE1_DISPOSABLE_PROJECT_REF: ref, PHASE1_CONFIRM_DISPOSABLE: 'I_CONFIRM_THIS_PROJECT_IS_DISPOSABLE',
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-only-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-privileged', PHASE1_APP_URL: 'http://127.0.0.1:3101', PHASE1_ACCEPTANCE_TOKEN: 'test-only-token-'.repeat(3),
  PHASE1_DATABASE_URL: `postgresql://postgres:test-only@db.${ref}.supabase.co:5432/postgres?sslmode=require` };
test('reset target requires independent matching URL, DB identity and disposable acknowledgment', () => {
  assert.equal(phase1Target(env, true).projectRef, ref);
  for (const change of [{ PHASE1_CONFIRM_DISPOSABLE: '' }, { NEXT_PUBLIC_SUPABASE_URL: 'https://' + 'b'.repeat(20) + '.supabase.co' },
    { PHASE1_DATABASE_URL: 'postgresql://postgres:test-only@db.' + 'b'.repeat(20) + '.supabase.co/postgres' },
    { PHASE1_DATABASE_URL: `postgresql://postgres.${'b'.repeat(20)}:test-only@aws-0-eu-west-2.pooler.supabase.com/postgres` },
    { PHASE1_DATABASE_URL: env.PHASE1_DATABASE_URL + '&sslmode=disable' }, { PHASE1_ACCEPTANCE_TOKEN: 'short' },
    { SUPABASE_SERVICE_ROLE_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, { SUPABASE_SERVICE_KEY: 'forbidden' }]) {
    assert.throws(() => phase1Target({ ...env, ...change }, true));
  }
});
test('application attestation rejects a forged proof before any database mutation', async () => {
  const target = phase1Target(env);
  const fingerprint = createHash('sha256').update(`${target.url}\0${target.anonKey}\0${ref}`).digest('hex');
  const reply = async (url, forged = false) => {
    const nonce = new URL(url).searchParams.get('nonce');
    const proof = createHmac('sha256', target.token).update(`${nonce}\0${fingerprint}\0${target.appUrl}`).digest('hex');
    return Response.json({ ok: true, targetFingerprint: fingerprint, proof: forged ? '0'.repeat(64) : proof });
  };
  assert.equal(await attestApplication(target, (url) => reply(url)), fingerprint);
  await assert.rejects(attestApplication(target, (url) => reply(url, true)), /proof mismatch/);
});
