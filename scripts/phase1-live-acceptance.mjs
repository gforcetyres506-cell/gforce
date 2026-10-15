import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { phase1Target } from './lib/phase1-target.mjs';

const CONFIRMATION = 'I_CONFIRM_THIS_PROJECT_IS_DISPOSABLE';
const startedAt = new Date().toISOString();
const checks = [];
const cleanup = [];

function required(name) {
  const value = process.env[name]?.trim();
  assert(value, `${name} is required.`);
  return value;
}

function record(name, status, detail) {
  checks.push({ name, status, detail });
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${status}: ${name}${suffix}`);
}

async function check(name, run) {
  try {
    const detail = await run();
    record(name, 'PASS', detail);
  } catch (error) {
    record(name, 'FAIL', error instanceof Error ? error.message : 'Unknown failure');
  }
}

function client(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function randomPassword() {
  return `Gf!${randomBytes(24).toString('base64url')}9a`;
}

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';', 1)[0]).join('; ');
}

async function json(response) {
  return response.json().catch(() => null);
}

async function appRequest(appUrl, path, init = {}) {
  return fetch(new URL(path, appUrl), { redirect: 'manual', signal: AbortSignal.timeout(15000), ...init });
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
const projectRef = required('PHASE1_DISPOSABLE_PROJECT_REF');
const appUrl = required('PHASE1_APP_URL');
const acceptanceToken = required('PHASE1_ACCEPTANCE_TOKEN');
const evidencePath = required('PHASE1_EVIDENCE_JSON');
assert(!existsSync(evidencePath), 'PHASE1_EVIDENCE_JSON must be a new file.');
mkdirSync(dirname(evidencePath), { recursive: true });

assert.equal(
  process.env.PHASE1_CONFIRM_DISPOSABLE,
  CONFIRMATION,
  `Set PHASE1_CONFIRM_DISPOSABLE=${CONFIRMATION} only after verifying the target.`,
);

const parsedUrl = new URL(supabaseUrl);
assert.equal(parsedUrl.protocol, 'https:', 'Disposable Supabase URL must use HTTPS.');
assert.equal(
  parsedUrl.hostname,
  `${projectRef}.supabase.co`,
  'PHASE1_DISPOSABLE_PROJECT_REF does not match NEXT_PUBLIC_SUPABASE_URL.',
);
assert.notEqual(anonKey, serviceRoleKey, 'Anon and service-role keys must differ.');
assert(!process.env.SUPABASE_SERVICE_KEY, 'Legacy SUPABASE_SERVICE_KEY is forbidden for this run.');
assert(acceptanceToken.length >= 32, 'PHASE1_ACCEPTANCE_TOKEN must contain at least 32 characters.');

const parsedAppUrl = new URL(appUrl);
assert(
  parsedAppUrl.protocol === 'https:' ||
    (parsedAppUrl.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(parsedAppUrl.hostname)),
  'PHASE1_APP_URL must use HTTPS, or HTTP on a loopback hostname.',
);
assert(!parsedAppUrl.username && !parsedAppUrl.password, 'PHASE1_APP_URL must not contain credentials.');
assert(!parsedAppUrl.search && !parsedAppUrl.hash, 'PHASE1_APP_URL must not contain a query or fragment.');
assert.equal(parsedAppUrl.pathname, '/', 'PHASE1_APP_URL must be an origin with no path.');

const service = client(supabaseUrl, serviceRoleKey);
const anonymous = client(supabaseUrl, anonKey);
const suffix = randomBytes(8).toString('hex');
const identities = {
  normal: { email: `phase1-normal-${suffix}@example.invalid`, password: randomPassword() },
  inactive: { email: `phase1-inactive-${suffix}@example.invalid`, password: randomPassword() },
  viewer: { email: `phase1-viewer-${suffix}@example.invalid`, password: randomPassword() },
  admin: { email: `phase1-admin-${suffix}@example.invalid`, password: randomPassword() },
  owner: { email: `phase1-owner-${suffix}@example.invalid`, password: randomPassword() },
};

async function createIdentity(label) {
  const identity = identities[label];
  const { data, error } = await service.auth.admin.createUser({
    email: identity.email,
    password: identity.password,
    email_confirm: true,
    user_metadata: { phase1_disposable_test: true, phase1_role: label },
  });
  assert.ifError(error);
  assert(data.user, `Supabase did not return the ${label} test user.`);
  identity.id = data.user.id;
  cleanup.push(async () => {
    const removed = await service.auth.admin.deleteUser(identity.id);
    assert.ifError(removed.error);
    assert(removed.data.user, `Cleanup did not return the deleted ${label} identity.`);
  });
}

async function insert(table, values, columns = 'id') {
  const { data, error } = await service.from(table).insert(values).select(columns).single();
  assert.ifError(error);
  assert(data, `No inserted row returned from ${table}.`);
  if (data.id) {
    cleanup.push(async () => {
      const removed = await service.from(table).delete().eq('id', data.id).select('id');
      assert.ifError(removed.error);
      assert.equal(removed.data?.length, 1, `Cleanup did not delete the ${table} sentinel.`);
    });
  }
  return data;
}

async function signIn(identity) {
  const signed = client(supabaseUrl, anonKey);
  const { data, error } = await signed.auth.signInWithPassword({
    email: identity.email,
    password: identity.password,
  });
  assert.ifError(error);
  assert(data.session, 'Expected a Supabase session.');
  return { client: signed, session: data.session };
}

const privateRows = {};
let inventoryProductId;

async function setup() {
  for (const label of Object.keys(identities)) await createIdentity(label);

  const { error: inactiveProfileError } = await service.from('admin_profiles').insert({
    user_id: identities.inactive.id,
    name: 'Phase 1 Inactive Admin',
    role: 'admin',
    active: false,
  });
  assert.ifError(inactiveProfileError);

  const { error: ownerProfileError } = await service.from('admin_profiles').insert({
    user_id: identities.owner.id,
    name: 'Phase 1 Active Owner',
    role: 'owner',
    active: true,
  });
  assert.ifError(ownerProfileError);
  for (const role of ['viewer', 'admin']) {
    const profile = await service.from('admin_profiles').insert({
      user_id: identities[role].id, name: `Phase 1 ${role}`, role, active: true,
    });
    assert.ifError(profile.error);
  }

  const zone = await insert('service_zones', {
    name: 'Phase 1 Sentinel Zone',
    postcode_prefix: `ZZ${suffix.slice(0, 6).toUpperCase()}`,
    callout_fee_pence: 0,
    active: false,
    priority: 9999,
  });
  const tyre = await insert('tyre_products', {
    sku: `PHASE1-${suffix}`,
    slug: `phase1-${suffix}`,
    brand: 'Acceptance Test',
    model: 'Sentinel',
    width: 225,
    profile: 45,
    rim: 18,
    season: 'summer',
    tier: 'standard',
    active: false,
  });
  inventoryProductId = tyre.id;
  const inventory = await insert('inventory', {
    tyre_product_id: tyre.id,
    stock_qty: 4,
    reserved_qty: 0,
    cost_price_pence: 10000,
    selling_price_pence: 15000,
  });
  const slot = await insert('booking_slots', {
    date: '2099-12-31',
    start_at: '09:00',
    end_at: '11:00',
    capacity: 1,
    active: false,
    blocked_reason: `phase1-${suffix}`,
  });
  const slotHold = await insert('slot_holds', {
    slot_id: slot.id,
    token: `phase1-${suffix}`,
    expires_at: '2099-12-31T23:59:59Z',
  });
  const inventoryHold = await insert('inventory_holds', {
    slot_hold_id: slotHold.id,
    tyre_product_id: tyre.id,
    quantity: 1,
    expires_at: '2099-12-31T23:59:59Z',
  });
  const customer = await insert('customers', {
    first_name: 'Phase',
    last_name: 'Sentinel',
    email: `phase1-customer-${suffix}@example.invalid`,
    phone: '00000000000',
  });
  const fitter = await insert('fitters', {
    name: 'Phase 1 Sentinel Fitter',
    active: false,
  });
  const booking = await insert('bookings', {
    reference: `GF-PHASE1-${suffix}`,
    customer_id: customer.id,
    slot_id: slot.id,
    fitter_id: fitter.id,
    service_zone_id: zone.id,
    fitting_address: 'Acceptance test only',
    postcode: 'ZZ0 0ZZ',
    status: 'pending_payment',
  });
  await insert('booking_items', {
    booking_id: booking.id,
    tyre_product_id: tyre.id,
    sku_snapshot: `PHASE1-${suffix}`,
    brand_snapshot: 'Acceptance Test',
    model_snapshot: 'Sentinel',
    size_snapshot: '225/45 R18',
    quantity: 1,
    unit_price_pence: 15000,
    line_total_pence: 15000,
  });
  const payment = await insert('payments', {
    booking_id: booking.id,
    provider: 'stripe',
    type: 'deposit',
    status: 'pending',
    amount_pence: 5000,
  });
  const audit = await insert('audit_logs', {
    admin_user_id: identities.owner.id,
    action: 'PHASE1_ACCEPTANCE_SENTINEL',
    resource_type: 'verification',
    metadata: { disposable: true },
  });
  const vrm = await insert('vrm_cache', {
    lookup_hash: `phase1-${suffix}`,
    encrypted_payload: '\\x00',
    expires_at: '2099-12-31T23:59:59Z',
  });

  privateRows.customers = customer.id;
  privateRows.payments = payment.id;
  privateRows.bookings = booking.id;
  privateRows.audit_logs = audit.id;
  privateRows.slot_holds = slotHold.id;
  privateRows.inventory_holds = inventoryHold.id;
  privateRows.vrm_cache = vrm.id;
  privateRows.inventory = inventory.id;
  privateRows.fitters = fitter.id;
  privateRows.rate_limits = (await insert('rate_limits', {
    bucket_key: `phase1-${suffix}`, hits: 1, expires_at: '2099-12-31T23:59:59Z',
  })).id;
  privateRows.email_outbox = (await insert('email_outbox', {
    booking_id: booking.id, deduplication_key: `phase1-${suffix}`,
    recipient: `phase1-${suffix}@example.invalid`, template: 'acceptance_test_only',
  })).id;
}

async function assertHidden(queryClient, table, id, mode) {
  const { data, error } = await queryClient.from(table).select('id').eq('id', id);
  if (mode === 'anon-error') {
    assert(error, `${table}: anonymous request was not denied.`);
    return;
  }
  assert.ifError(error);
  assert.equal(data.length, 0, `${table}: unauthorized authenticated user saw a private row.`);
}

async function assertOwnerCanRead(queryClient, table, id) {
  const { data, error } = await queryClient.from(table).select('id').eq('id', id);
  assert.ifError(error);
  assert.equal(data.length, 1, `${table}: active owner could not read the sentinel row.`);
}

async function assertMutationDenied(queryClient, actor) {
  const insertAttempt = await queryClient.from('customers').insert({
    first_name: 'Unauthorized',
    last_name: actor,
    email: `blocked-${actor}-${suffix}@example.invalid`,
    phone: '00000000000',
  });
  assert(insertAttempt.error, `${actor}: unauthorized INSERT did not fail.`);

  const updateAttempt = await queryClient
    .from('customers')
    .update({ first_name: 'Tampered' })
    .eq('id', privateRows.customers);
  assert(updateAttempt.error, `${actor}: unauthorized UPDATE did not fail.`);

  const deleteAttempt = await queryClient
    .from('customers')
    .delete()
    .eq('id', privateRows.customers);
  assert(deleteAttempt.error, `${actor}: unauthorized DELETE did not fail.`);

  const { data, error } = await service
    .from('customers')
    .select('first_name')
    .eq('id', privateRows.customers)
    .single();
  assert.ifError(error);
  assert.equal(data.first_name, 'Phase', `${actor}: sentinel customer changed.`);
}

async function run() {
  const attestationNonce = randomBytes(32).toString('hex');
  const targetResponse = await appRequest(
    appUrl,
    `/api/admin/acceptance-target?nonce=${attestationNonce}`,
  );
  assert.equal(targetResponse.status, 200, 'Application target attestation failed before mutation.');
  const targetBody = await json(targetResponse);
  const expectedFingerprint = createHash('sha256')
    .update(`${supabaseUrl}\0${anonKey}\0${projectRef}`)
    .digest('hex');
  assert.equal(targetBody?.ok, true, 'Application target attestation did not return ok.');
  assert.equal(
    targetBody?.targetFingerprint,
    expectedFingerprint,
    'PHASE1_APP_URL is not configured for the authorized disposable Supabase target.',
  );
  assert.match(targetBody?.proof ?? '', /^[a-f0-9]{64}$/, 'Application attestation proof is malformed.');
  const expectedProof = createHmac('sha256', acceptanceToken)
    .update(`${attestationNonce}\0${expectedFingerprint}\0${parsedAppUrl.origin}`)
    .digest();
  const receivedProof = Buffer.from(targetBody.proof, 'hex');
  assert(
    receivedProof.length === expectedProof.length && timingSafeEqual(receivedProof, expectedProof),
    'Application target attestation proof is invalid.',
  );
  record('Application is bound to the disposable Supabase target', 'PASS');

  const replay = JSON.parse(readFileSync(required('PHASE1_RESET_EVIDENCE_JSON'), 'utf8'));
  assert(replay.result === 'PASS' && replay.projectRef === projectRef && replay.targetFingerprint === expectedFingerprint
    && replay.checks?.TARGET_ATTESTATION === 'PASS' && replay.checks?.MIGRATIONS === 'PASS'
    && replay.checks?.SCHEMA === 'PASS', 'Fresh reset evidence does not match this target.');
  assert(Date.now() - Date.parse(replay.finishedAt) >= 0 && Date.now() - Date.parse(replay.finishedAt) < 86400000,
    'Reset evidence must be less than 24 hours old.');
  const currentMigrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  assert.deepEqual(replay.migrations?.map((m) => m.file), currentMigrations, 'Migration chain changed since reset.');
  for (const migration of replay.migrations) assert.equal(migration.sha256,
    createHash('sha256').update(readFileSync('supabase/migrations/' + migration.file)).digest('hex'), 'Migration changed since reset.');
  record('Entire migration chain replayed from zero on this attested target', 'PASS');

  const dbTarget = phase1Target(process.env, true);
  const catalogueClient = new Client({ connectionString: dbTarget.databaseUrl.toString(),
    ssl: { rejectUnauthorized: true, ...(process.env.PHASE1_DATABASE_CA_FILE ? { ca: readFileSync(process.env.PHASE1_DATABASE_CA_FILE, 'utf8') } : {}) },
    connectionTimeoutMillis: 15000 });
  try {
    await catalogueClient.connect();
    const result = await catalogueClient.query(readFileSync('supabase/verification/phase1_catalog_checks.sql', 'utf8'));
    const counts = (Array.isArray(result) ? result : [result]).flatMap((r) => r.rows).filter((r) => 'result' in r);
    assert(counts.length >= 8 && counts.every((c) => c.result === 'PASS'), 'Live schema catalog verification failed.');
    record('Live tables, constraints, FKs, indexes, functions, triggers, RLS and grants match', 'PASS');
  } finally { await catalogueClient.end(); }

  const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: anonKey }, signal: AbortSignal.timeout(15000),
  });
  assert.equal(settingsResponse.status, 200, 'Cannot verify Auth signup configuration.');
  assert.equal((await json(settingsResponse))?.disable_signup, true, 'Disable public Auth signup in the disposable project before acceptance.');
  record('Public Auth signup is disabled', 'PASS');

  await setup();
  record('Disposable identities and sentinel rows created', 'PASS');

  await check('Anonymous admin route redirects to login', async () => {
    const response = await appRequest(appUrl, '/admin');
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), '/admin/login');
  });

  await check('Wrong password is denied generically', async () => {
    const response = await appRequest(appUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: identities.owner.email,
        password: `wrong-${identities.owner.password}`,
      }),
    });
    assert.equal(response.status, 401);
    assert.equal((await json(response))?.error, 'invalid_credentials');
  });

  await check('Anonymous admin mutation is denied', async () => {
    const response = await appRequest(appUrl, '/api/admin/slots/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_active', slotId: 'acceptance-test' }),
    });
    assert.equal(response.status, 401);
  });

  const normal = await signIn(identities.normal);
  const inactive = await signIn(identities.inactive);
  const owner = await signIn(identities.owner);
  const viewer = await signIn(identities.viewer);
  const admin = await signIn(identities.admin);

  for (const [label, signed] of [['normal', normal], ['viewer', viewer], ['admin', admin], ['owner', owner]]) {
    await check(`${label} refresh-token exchange succeeds`, async () => {
      const refreshed = await signed.client.auth.refreshSession();
      assert.ifError(refreshed.error); assert(refreshed.data.session);
      signed.session = refreshed.data.session;
    });
  }

  for (const [table, id] of Object.entries(privateRows)) {
    await check(`Anonymous SELECT denial: ${table}`, () =>
      assertHidden(anonymous, table, id, 'anon-error'));
    await check(`Normal-user RLS denial: ${table}`, () =>
      assertHidden(normal.client, table, id, 'filtered'));
    await check(`Inactive-admin RLS denial: ${table}`, () =>
      assertHidden(inactive.client, table, id, 'filtered'));
    await check(`Active-owner RLS read: ${table}`, () =>
      assertOwnerCanRead(owner.client, table, id));
    await check(`Viewer RLS read: ${table}`, () => assertOwnerCanRead(viewer.client, table, id));
    await check(`Admin RLS read: ${table}`, () => assertOwnerCanRead(admin.client, table, id));
  }

  for (const [actor, actorClient] of [
    ['anonymous', anonymous],
    ['normal-user', normal.client],
    ['inactive-admin', inactive.client],
    ['active-owner', owner.client],
    ['viewer', viewer.client],
    ['admin', admin.client],
  ]) {
    await check(`Unauthorized INSERT/UPDATE/DELETE denied: ${actor}`, () =>
      assertMutationDenied(actorClient, actor));
  }

  for (const label of ['normal', 'inactive']) {
    await check(`${label} app login denied generically`, async () => {
      const response = await appRequest(appUrl, '/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: identities[label].email,
          password: identities[label].password,
        }),
      });
      assert.equal(response.status, 401);
      const body = await json(response);
      assert.equal(body?.error, 'invalid_credentials');
    });
  }

  let appCookie = '';
  await check('Active-owner app login succeeds', async () => {
    const response = await appRequest(appUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: identities.owner.email,
        password: identities.owner.password,
      }),
    });
    assert.equal(response.status, 200);
    assert.equal((await json(response))?.ok, true);
    appCookie = cookieHeader(response);
    assert(appCookie, 'No session cookie was set.');
  });

  await check('Viewer read-only, admin operational, owner access management; current sessions obey role changes', async () => {
    const login = async (label) => {
      const response = await appRequest(appUrl, '/api/admin/login', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: identities[label].email, password: identities[label].password }),
      });
      assert.equal(response.status, 200); const cookie = cookieHeader(response); assert(cookie); return cookie;
    };
    const viewerCookie = await login('viewer'); const adminCookie = await login('admin');
    const mutate = (path, cookie, body) => appRequest(appUrl, path, { method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json', origin: parsedAppUrl.origin }, body: JSON.stringify(body) });
    const inventoryChange = { tyre_product_id: inventoryProductId, stock_qty: 6 };
    const accessChange = { user_id: identities.admin.id, role: 'viewer', active: true };
    for (const [label, cookie] of [['viewer', viewerCookie], ['admin', adminCookie], ['owner', appCookie]]) {
      assert.equal((await appRequest(appUrl, '/api/admin/session', { headers: { cookie } })).status, 200, `${label} cannot read`);
      assert.equal((await mutate('/api/admin/inventory', cookie, inventoryChange)).status, label === 'viewer' ? 403 : 200);
    }
    assert.equal((await mutate('/api/admin/access', viewerCookie, accessChange)).status, 403);
    assert.equal((await mutate('/api/admin/access', adminCookie, accessChange)).status, 403);
    assert.equal((await mutate('/api/admin/access', appCookie, accessChange)).status, 200);
    assert.equal((await mutate('/api/admin/inventory', adminCookie, inventoryChange)).status, 403, 'Demoted session retained operational access');
    assert.equal((await mutate('/api/admin/access', appCookie, { ...accessChange, role: 'admin', active: false })).status, 200);
    assert.equal((await appRequest(appUrl, '/api/admin/session', { headers: { cookie: adminCookie } })).status, 403);
    assert.equal((await mutate('/api/admin/access', appCookie, { ...accessChange, role: 'admin' })).status, 200);
    assert.equal((await mutate('/api/admin/access', appCookie, { user_id: identities.owner.id, role: 'viewer', active: false })).status, 409, 'Last owner could be removed');
    const saved = await service.from('inventory').select('stock_qty').eq('tyre_product_id', inventoryProductId).single();
    assert.ifError(saved.error); assert.equal(saved.data.stock_qty, 6);
    const audits = await service.from('audit_logs').select('id,admin_user_id').eq('action', 'inventory.updated')
      .in('admin_user_id', [identities.admin.id, identities.owner.id]);
    assert.ifError(audits.error); assert.equal(audits.data.length, 2, 'Each inventory mutation must persist exactly one audit');
  });

  await check('Active-owner session persists across refreshes', async () => {
    const rootResponse = await appRequest(appUrl, '/admin', {
      headers: { cookie: appCookie },
    });
    assert.equal(rootResponse.status, 307);
    assert.equal(rootResponse.headers.get('location'), '/admin/bookings');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await appRequest(appUrl, '/admin/bookings', {
        headers: { cookie: appCookie },
      });
      assert.equal(response.status, 200);
    }
  });

  await check('Application logout clears the browser session', async () => {
    const response = await appRequest(appUrl, '/api/admin/logout', {
      method: 'POST',
      headers: { cookie: appCookie },
    });
    assert.equal(response.status, 200);
    const setCookie = response.headers.get('set-cookie') ?? '';
    assert(/max-age=0|expires=/i.test(setCookie), 'Logout did not emit an expiring cookie.');
    const after = await appRequest(appUrl, '/admin');
    assert.equal(after.status, 307);
    assert.equal(after.headers.get('location'), '/admin/login');

    const replay = await appRequest(appUrl, '/admin/bookings', {
      headers: { cookie: appCookie },
    });
    assert.equal(replay.status, 307, 'The pre-logout session cookie remained usable.');
    assert.equal(replay.headers.get('location'), '/admin/login');
  });

  await check('Global refresh-token revocation succeeds', async () => {
    const relogin = await appRequest(appUrl, '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: identities.owner.email, password: identities.owner.password }) });
    assert.equal(relogin.status, 200);
    const liveCookie = cookieHeader(relogin); assert(liveCookie);
    const { error } = await service.auth.admin.signOut(owner.session.access_token, 'global');
    assert.ifError(error);
    const refreshed = await owner.client.auth.refreshSession();
    assert(refreshed.error, 'Refresh token remained usable after global revocation.');
    const replay = await appRequest(appUrl, '/api/admin/session', { headers: { cookie: liveCookie } });
    assert.equal(replay.status, 401, 'Globally revoked session remained usable at the server');
    const oldJwt = await fetch(`${supabaseUrl}/rest/v1/customers?select=id`, {
      headers: { apikey: anonKey, authorization: `Bearer ${owner.session.access_token}` },
    });
    assert.equal(oldJwt.status, 200);
    assert.deepEqual(await json(oldJwt), [], 'Revoked JWT still bypassed private-row RLS');
  });

  await check('Account deactivation immediately blocks a live owner session', async () => {
    const relogin = await appRequest(appUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: identities.owner.email,
        password: identities.owner.password,
      }),
    });
    assert.equal(relogin.status, 200);
    const liveCookie = cookieHeader(relogin);
    assert(liveCookie, 'No owner cookie available for deactivation test.');

    const deactivated = await service
      .from('admin_profiles')
      .update({ active: false })
      .eq('user_id', identities.owner.id);
    assert.ifError(deactivated.error);

    const denied = await appRequest(appUrl, '/admin/bookings', {
      headers: { cookie: liveCookie },
    });
    assert.equal(denied.status, 403);

    const restored = await service
      .from('admin_profiles')
      .update({ active: true })
      .eq('user_id', identities.owner.id);
    assert.ifError(restored.error);
  });

  await check('Browser bundle excludes service-role material', async () => {
    const staticRoot = join(process.cwd(), '.next', 'static');
    assert(existsSync(staticRoot), 'Run the production build before live acceptance.');
    for (const file of walk(staticRoot).filter((path) => path.endsWith('.js'))) {
      const source = readFileSync(file, 'utf8');
      assert(!source.includes('SUPABASE_SERVICE_ROLE_KEY'), `Variable name found in ${file}.`);
      assert(!source.includes(serviceRoleKey), `Service-role value found in ${file}.`);
    }
  });
}

let fatalError = null;
try {
  await run();
} catch (error) {
  fatalError = error;
  record('Acceptance harness execution', 'FAIL', error instanceof Error ? error.message : 'Unknown failure');
} finally {
  if (identities.owner.id) {
    const audits = await service.from('audit_logs').delete().in('admin_user_id', Object.values(identities).map((i) => i.id).filter(Boolean))
      .in('action', ['inventory.updated', 'admin.access_updated']);
    if (audits.error) record('Disposable operational audit cleanup', 'FAIL', 'Cleanup did not delete the acceptance operational audit rows.');
  }
  for (const remove of cleanup.reverse()) {
    try {
      await remove();
    } catch {
      record('Disposable cleanup action', 'FAIL', 'One cleanup action failed. Reset the disposable database.');
    }
  }
}

const failed = checks.filter((item) => item.status !== 'PASS');
const evidence = {
  schemaVersion: 1,
  startedAt,
  finishedAt: new Date().toISOString(),
  result: failed.length === 0 && !fatalError ? 'PASS' : 'FAIL',
  projectRefMatchedConfiguredUrl: true,
  disposableConfirmation: true,
  checks,
};

if (evidencePath) {
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

console.log(JSON.stringify(evidence, null, 2));
process.exitCode = evidence.result === 'PASS' ? 0 : 1;
