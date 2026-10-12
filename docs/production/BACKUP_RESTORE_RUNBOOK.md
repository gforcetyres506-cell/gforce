# Backup and restore

Local rehearsal: PASS; hosted capability/retention and authorized cloud restore:
BLOCKED. Run `node scripts/gate2-local-postgres.mjs restore` for a fresh loopback
cluster, all 18 migrations, audited Gate 4 fixture operations, `pg_dump` custom
archive, new database and `pg_restore --exit-on-error`. Evidence is
`../launch/evidence/SHIP_LOCAL_RESTORE.json`: 24 tables/85 fixture rows matched
exactly and eight catalogue checks passed. Archive bytes stay ignored/private.
Local elapsed time is not a production RTO (time to recover) guarantee.

Hosted prerequisites: client-owned source project, current backup schedule and
retention, encryption/access owner, off-site copy where appropriate, and a
separately authorized empty disposable destination. Prove destination identity
independently before restoration. Never use production as a rehearsal target.

Use the provider's supported backup/restore flow for the actual plan/version.
Preserve application migrations/ledger, Auth data/configuration, role/grant/RLS
state, secrets/configuration in the secure vault, and separately backed-up Storage
objects/settings if used. Database backups contain Storage metadata, not file bytes.
Do not indiscriminately replay Supabase-managed schema DDL from a plain local dump
against hosted platform schemas. Follow the provider restore procedure.

After restoring to disposable, verify ledger/hash chain, eight catalogue checks,
Auth/session access and owner/admin/viewer denials, private-data isolation, booking
and payment invariants, audit immutability, outbox idempotency and a full hosted
journey. Disable external sends and reconcile outbox/provider history before any
retry. Verify restored files separately. Keep sanitized evidence and destroy test
data only under the explicit disposable authorization.

RPO (maximum tolerable data loss): UNKNOWN until the actual backup/PITR schedule
and business tolerance are approved. A daily-only backup could lose almost a day
of changes. RTO: UNKNOWN until timed hosted restore plus application verification
and bank/outbox reconciliation. Choose targets with the owner; do not advertise
the local 2-second rehearsal as a customer recovery promise.

For production recovery, approve the restore point and destination, suspend unsafe
writes, preserve current evidence, reconcile bank transfers after the restore
point, restore through the approved provider path, and verify before reopening.
Prefer a forward fix/compensating migration when data recovery is unnecessary.

Sources checked 12 October 2026: [Supabase backups](https://supabase.com/docs/guides/platform/backups),
[restore to a new project](https://supabase.com/docs/guides/platform/clone-project),
[backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
