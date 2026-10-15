import assert from 'node:assert/strict';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';

// No external connection string is accepted. Start a fresh, loopback-only
// PostgreSQL cluster; retain its ignored directory for forensic inspection.
const suite = process.argv[2] ?? 'gate2';
assert(['gate2','gate3','gate4','restore'].includes(suite), 'Only the reviewed local suites are allowed');
const root = resolve('.local-postgres');
const bin = resolve(process.env.GATE2_POSTGRES_BIN ?? join(root, 'engine/pgsql/bin'));
const exe = (name) => join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
assert(existsSync(exe('initdb')), 'Install official PostgreSQL binaries; see docs/production/04_GATE2_BOOKING_ENGINE.md');
const data = join(root, 'run-' + randomUUID());
mkdirSync(data, { recursive: true });
const port = await new Promise((done, fail) => {
  const server = createServer(); server.once('error', fail);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => done(port)); });
});
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, ...options });
  assert.equal(result.status, 0, (result.stderr ?? '') + (result.stdout ?? '') + (result.error?.message ?? ''));
  return result;
}
run(exe('initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']);
let started = false;
try {
  // On Windows the daemon inherits pg_ctl's pipe handles. Ignore those pipes
  // (the database logs to server.log) so spawnSync can observe pg_ctl exiting.
  run(exe('pg_ctl'), ['-D', data, '-l', join(data, 'server.log'), '-o', `-h 127.0.0.1 -p ${port} -c max_connections=60`, '-w', 'start'], { stdio: 'ignore' });
  started = true;
  const localEnv = { ...process.env, GATE2_POSTGRES_BIN: bin,
    GATE2_LOCAL_DATA_DIR: data, GATE2_TEST_DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres` };
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'tests/concurrency/'+(suite === 'restore' ? 'gate4' : suite)+'.test.mjs'], {
    stdio: 'inherit', windowsHide: true, env: localEnv,
  });
  process.exitCode = result.status ?? 1;
  if (suite === 'restore' && result.status === 0) {
    const restored = spawnSync(process.execPath, ['scripts/ship-local-restore.mjs'], { stdio:'inherit',windowsHide:true,env:localEnv });
    process.exitCode = restored.status ?? 1;
  }
} finally {
  if (started) run(exe('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop']);
}
