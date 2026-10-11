import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { phase1Target, attestApplication } from './lib/phase1-target.mjs';

// NEVER select a linked/default project or read credentials from command output.
// This command resets public application objects, not Supabase-managed schemas.
const evidence = { gate: 0, startedAt: new Date().toISOString(), result: 'BLOCKED', checks: {} };
let db;
let evidencePath;
try {
  assert(process.argv.includes('--reset'), 'Destructive replay requires the explicit --reset argument');
  const target = phase1Target(process.env, true);
  evidencePath = process.env.PHASE1_RESET_EVIDENCE_JSON?.trim();
  assert(evidencePath && !existsSync(evidencePath), 'A new PHASE1_RESET_EVIDENCE_JSON path is required before reset');
  mkdirSync(dirname(evidencePath), { recursive: true });
  const fingerprint = await attestApplication(target);
  const service = createClient(target.url, target.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const identity = await service.auth.admin.listUsers({ page: 1, perPage: 1 });
  assert(!identity.error, 'Service credentials did not authenticate to the attested project');
  db = new Client({ connectionString: target.databaseUrl.toString(),
    ssl: { rejectUnauthorized: true, ...(process.env.PHASE1_DATABASE_CA_FILE ? { ca: readFileSync(process.env.PHASE1_DATABASE_CA_FILE, 'utf8') } : {}) },
    connectionTimeoutMillis: 15000, application_name: 'gforce_gate0_disposable_acceptance' });
  await db.connect();
  const server = await db.query('select current_database() as database, current_user as actor');
  assert.equal(server.rows[0].database, 'postgres', 'Unexpected database');
  assert.equal(server.rows[0].actor, 'postgres', 'Reset requires the project database owner');
  evidence.projectRef = target.projectRef;
  evidence.targetFingerprint = fingerprint;
  evidence.checks.TARGET_ATTESTATION = 'PASS';
  console.log(`TARGET ATTESTATION PASS: ${target.projectRef}; app, service credentials and TLS database target matched. Reset begins now.`);

  const migrations = readdirSync('supabase/migrations').filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  assert.equal(migrations.length, 18, 'Unexpected migration chain; review before reset');
  evidence.migrations = migrations.map((file) => ({ file, sha256: createHash('sha256').update(readFileSync('supabase/migrations/' + file)).digest('hex') }));
  await db.query('begin');
  try {
    await db.query('drop schema public cascade; create schema public; grant usage on schema public to postgres, anon, authenticated, service_role');
    await db.query('create schema if not exists supabase_migrations');
    await db.query('create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text)');
    await db.query('truncate supabase_migrations.schema_migrations');
    for (const file of migrations) {
      const sql = readFileSync('supabase/migrations/' + file, 'utf8');
      await db.query(sql);
      await db.query('insert into supabase_migrations.schema_migrations(version,statements,name) values ($1,$2,$3)', [file.split('_')[0], [sql], file.replace(/^\d+_|\.sql$/g, '')]);
    }
    const catalogue = readFileSync('supabase/verification/phase1_catalog_checks.sql', 'utf8')
      .replace(/^begin;\s*$/m, '').replace(/^rollback;\s*$/m, '');
    const result = await db.query(catalogue);
    const checks = (Array.isArray(result) ? result : [result]).flatMap((r) => r.rows).filter((r) => 'result' in r);
    assert(checks.length >= 8 && checks.every((r) => r.result === 'PASS'), 'Catalog verification failed');
    evidence.catalogue = checks;
    await db.query("notify pgrst, 'reload schema'");
    await db.query('commit');
    evidence.checks.MIGRATIONS = 'PASS'; evidence.checks.SCHEMA = 'PASS';
    evidence.result = 'PASS';
    console.log('MIGRATIONS PASS; SCHEMA PASS. Run test:phase1:live for Auth/RLS/RBAC/session acceptance.');
  } catch (error) { await db.query('rollback'); throw error; }
} catch (error) {
  evidence.result = evidence.checks.TARGET_ATTESTATION === 'PASS' ? 'FAIL' : 'BLOCKED';
  // Avoid emitting credentials, connection strings, SQL payloads or stack traces.
  let message = error instanceof Error ? error.message : 'Acceptance runner failed';
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'PHASE1_DATABASE_URL', 'PHASE1_ACCEPTANCE_TOKEN']) {
    if (process.env[name]) message = message.replaceAll(process.env[name], '[redacted]');
  }
  evidence.reason = message;
  console.error(`${evidence.result}: ${message}`);
  process.exitCode = 1;
} finally {
  if (db) await db.end().catch(() => {});
  evidence.finishedAt = new Date().toISOString();
  if (evidencePath && !existsSync(evidencePath)) writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
}
