import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

const expectedMigrations = [
  '001_extensions.sql',
  '002_admin_profiles.sql',
  '003_customers.sql',
  '004_service_zones.sql',
  '005_catalogue.sql',
  '006_availability.sql',
  '007_booking_resources.sql',
  '008_bookings.sql',
  '009_payments.sql',
  '010_operations.sql',
  '011_rls.sql',
  '012_indexes.sql',
  '013_gate0_canonical_foundation.sql',
  '014_gate0_access_boundary.sql',
  '015_gate1_owner_business_data.sql',
  '016_gate2_atomic_booking.sql',
  '017_gate3_manual_bank_payments.sql',
  '018_gate4_admin_operating_system.sql',
];

assert.deepEqual(
  readdirSync(join(root, 'supabase', 'migrations')).sort(),
  expectedMigrations,
  'Migration set or order differs from the approved Phase 1 plan.',
);

const allSql = expectedMigrations.map((name) => read(`supabase/migrations/${name}`)).join('\n');
const requiredTables = [
  'admin_profiles', 'customers', 'service_zones', 'tyre_products', 'inventory',
  'availability_rules', 'booking_slots', 'blocked_dates', 'slot_holds',
  'inventory_holds', 'bookings', 'booking_items', 'payments', 'webhook_events',
  'fitters', 'business_settings', 'audit_logs', 'vrm_cache', 'interest_registrations', 'rate_limits', 'email_outbox', 'special_dates',
];

for (const table of requiredTables) {
  assert.match(allSql, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'));
  assert.match(
    allSql,
    new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
  );
}

for (const route of [
  'src/app/api/admin/slots/generate/route.ts',
  'src/app/api/admin/slots/update/route.ts',
]) {
  assert.match(read(route), /await requireAdmin\(\)/, `${route} does not independently authorize.`);
}

const login = read('src/app/admin/login/page.tsx');
assert.doesNotMatch(login, /1-Click Demo Login|admin@gforcetyres|automatic redirect/i);
assert.match(login, /\/api\/admin\/login/);

const mockConfirmation = read('src/app/api/checkout/confirm-mock/route.ts');
assert.match(mockConfirmation, /status: 404/);
assert.doesNotMatch(mockConfirmation, /confirmBookingPaid|createServiceClient|ok: true/);

const unsafeConfig = spawnSync(
  process.execPath,
  ['-e', "import('./next.config.mjs')"],
  {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, APP_ENV: 'production', ENABLE_MOCK_DATA: 'true' },
  },
);
assert.notEqual(unsafeConfig.status, 0, 'Production mock mode did not fail configuration load.');
assert.match(`${unsafeConfig.stdout}${unsafeConfig.stderr}`, /Unsafe configuration/);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

for (const file of walk(join(root, 'src')).filter((path) => /\.(ts|tsx)$/.test(path))) {
  const source = readFileSync(file, 'utf8');
  if (/^[\s]*['\"]use client['\"];/.test(source)) {
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  }
}

const staticRoot = join(root, '.next', 'static');
if (existsSync(staticRoot)) {
  for (const file of walk(staticRoot).filter((path) => path.endsWith('.js'))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /SUPABASE_SERVICE_ROLE_KEY/);
  }
}

assert(existsSync(join(root, 'supabase', 'verification', 'phase1_catalog_checks.sql')));
const catalogueChecks = read('supabase/verification/phase1_catalog_checks.sql');
assert.match(catalogueChecks, /p\.permissive = 'PERMISSIVE'/);
assert.match(catalogueChecks, /p\.cmd = 'SELECT'/);
assert.match(catalogueChecks, /p\.with_check is null/);
assert.match(catalogueChecks, /has_column_privilege/);
assert.match(catalogueChecks, /index_relation\.relkind = 'i'/);
assert.match(catalogueChecks, /case when actual = expected then 'PASS' else 'FAIL' end/);

assert(existsSync(join(root, 'src', 'app', 'api', 'admin', 'acceptance-target', 'route.ts')));
const targetAttestation = read('src/app/api/admin/acceptance-target/route.ts');
assert.match(targetAttestation, /PHASE1_ACCEPTANCE_TOKEN/);
assert.match(targetAttestation, /PHASE1_APP_URL/);
assert.match(targetAttestation, /createHmac/);
assert.match(targetAttestation, /nonce/);
assert.match(targetAttestation, /targetFingerprint/);

const liveAcceptance = read('scripts/phase1-live-acceptance.mjs');
assert.match(liveAcceptance, /I_CONFIRM_THIS_PROJECT_IS_DISPOSABLE/);
assert.match(liveAcceptance, /PHASE1_DISPOSABLE_PROJECT_REF/);
assert.match(liveAcceptance, /PHASE1_ACCEPTANCE_TOKEN/);
assert.match(liveAcceptance, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(liveAcceptance, /Legacy SUPABASE_SERVICE_KEY is forbidden/);
assert.match(liveAcceptance, /Application target attestation failed before mutation/);
assert.match(liveAcceptance, /timingSafeEqual/);
assert.doesNotMatch(liveAcceptance, /authorization:\s*`Bearer \$\{acceptanceToken\}`/);
assert.match(liveAcceptance, /The pre-logout session cookie remained usable/);
assert.match(liveAcceptance, /Cleanup did not delete the/);
for (const table of [
  'customers', 'payments', 'bookings', 'audit_logs',
  'slot_holds', 'inventory_holds', 'vrm_cache',
]) {
  assert.match(liveAcceptance, new RegExp(`privateRows\\.${table}`));
}

console.log('Security structure checks passed. Live Supabase role scenarios remain gated integration tests.');
