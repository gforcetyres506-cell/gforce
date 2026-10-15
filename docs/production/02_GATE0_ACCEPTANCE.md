# Gate 0 - canonical Supabase / Auth / RLS acceptance

Date: 2026-10-10. Branch: `gate/0-live-supabase`.
Baseline: `545bac195fcabdd71e722a4412baa6dbd0dc05cd`.
Overall: **PHASE 1 - BLOCKED; NOT LIVE VERIFIED**.

## Actual evidence

No authorized disposable project reference, cloud credentials or database
connection was available in this workspace or process environment. A request
for the project identity and an ignored credential-file path is pending. No
cloud reset, migration, Auth setting change, user creation or database write
was performed. No production target was selected.

| Required result | Current result | Evidence and limit |
| --- | --- | --- |
| TARGET ATTESTATION | BLOCKED | No authorized reference/target. Reset runner exits before any connection: PHASE1_DISPOSABLE_PROJECT_REF is required. |
| MIGRATIONS | BLOCKED for cloud; local PASS | All 14 actual SQL files replay in PostgreSQL/WASM, including pgcrypto. Minimal Auth tables/functions are test stand-ins. Original 001-012 unchanged. |
| SCHEMA | BLOCKED for cloud; local PASS | 21 tables/PKs/RLS-enabled tables, 17 unique constraints, 51 check constraints, 15 FKs, 21 required named indexes, 24 SELECT policies; required functions, eight update triggers and grants verified. |
| AUTH | BLOCKED for cloud | Local tests cannot prove Supabase password login, provider signup configuration or GoTrue behavior. |
| RLS | BLOCKED for cloud; local PASS | SQL tests exercise anonymous, normal, viewer, inactive admin, admin and owner access. All browser roles are denied direct private INSERT/UPDATE/DELETE and privileged RPC execution. |
| RBAC | BLOCKED for cloud; local PASS | Actual server guards tested with isolated Auth responses; SQL functions reject unauthorized actors and retain the last owner. No hosted HTTP proof yet. |
| SESSIONS | BLOCKED for cloud; local checks PASS | SQL tests delete a session and verify denial using unchanged JWT claims. Real login, refresh exchange, cookie logout/replay and provider revocation are pending. |
| SECRET ISOLATION | PASS locally | Compiled .next/static JavaScript and maps contain zero SUPABASE_SERVICE_ROLE_KEY occurrences. Live harness also checks the actual supplied key value when credentials exist. |
| BUILD | PASS locally | Playwright webServer ran npm run build followed by next start. .next/BUILD_ID exists; all 119 UI tests passed against that production build. |

Additional checks: TypeScript PASS; lint PASS (0 errors, 4 existing warnings);
58/58 reliability/security-boundary unit tests; 12/12 PostgreSQL tests;
119/119 Playwright tests at 360, 375, 390, 430, 768, 1366 and 1440 pixels;
security structure checks PASS. Final whitespace check is recorded in progress.
The PostgreSQL engine executes real migrations, constraints, RLS and functions;
its test Auth stand-in does not implement Supabase Auth or PostgREST.

## What changed

- Forward migrations `013_gate0_canonical_foundation.sql` and
  `014_gate0_access_boundary.sql` add viewer, rate limits and the email outbox;
  normalize stored tyre tiers; gate unconfigured pricing; and enforce the
  read-only browser/server-mutation boundary.
- Real sessions and current active profiles are checked in server guards and
  private RLS. Owner-only access management and admin/owner inventory updates
  persist together with their audit records. Removing the last owner is denied.
- Runtime queries use canonical tables and explicit response mappings. Public
  projections omit costs/internal notes. Confirmation requires an unguessable
  management capability as well as its reference.
- V1 customer account routes are retired. No public admin provisioning exists.
  Public signup must also be disabled at the provider; acceptance checks this.
- The conflicting legacy schema is preserved in `supabase/archive/`, outside
  executable migration discovery. No useful migration was removed or rewritten.

## Authorized disposable-cloud procedure

Do not execute this procedure until the human owner supplies and explicitly
authorizes the exact disposable project reference/name and deletion of its
application schema and acceptance records. Never infer a target from a linked
Supabase CLI project, an existing production URL, repository defaults or a key
found elsewhere. Do not overwrite existing local environment files.

1. Independently verify the authorized reference in Supabase Dashboard. Disable
   public account signup for that disposable project. Keep email/password
   login enabled for explicitly provisioned acceptance users.
2. Populate an ignored `.env.gate0.local` file with the real URL, anon key,
   service-role key and `PHASE1_DATABASE_URL`. Keep all secret values out of chat,
   Git, logs and command arguments. Use a direct `db.<authorized-ref>.supabase.co`
   connection as `postgres`, or the documented session pooler with username
   `postgres.<authorized-ref>` and port 5432. TLS certificate/hostname validation
   is mandatory; supply `PHASE1_DATABASE_CA_FILE` if needed.
3. Set `PHASE1_DISPOSABLE_PROJECT_REF` to the authorized reference,
   `PHASE1_CONFIRM_DISPOSABLE=I_CONFIRM_THIS_PROJECT_IS_DISPOSABLE`, and a private
   random `PHASE1_ACCEPTANCE_TOKEN` of at least 32 characters. Set
   `PHASE1_APP_URL` and `APP_URL` to `http://127.0.0.1:3101` for the isolated local
   production server. Set `ENABLE_MOCK_DATA=false`. Leave provider payment/email
   settings outside this gate. These acceptance flags must remain absent on
   production deployments.
4. Set unique output paths in `PHASE1_RESET_EVIDENCE_JSON` and
   `PHASE1_EVIDENCE_JSON`. The scripts refuse to overwrite evidence files. Their
   reports exclude passwords, keys, tokens and connection strings. Store them
   in `docs/production/evidence/` only after checking their contents.
5. Build and start the application with that environment in two sequential
   commands; keep the second command running in its own terminal:

```powershell
node --env-file=.env.gate0.local node_modules/next/dist/bin/next build
node --env-file=.env.gate0.local node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3101
```

6. Run the explicitly destructive replay from another terminal:

```powershell
node --env-file=.env.gate0.local scripts/gate0-cloud-reset.mjs --reset
```

The runner first verifies app HMAC challenge proof, exact project URL/reference,
service authentication and the TLS database hostname/user. Only after printing
TARGET ATTESTATION PASS does it drop/recreate the disposable public application
schema, replace its migration ledger and apply all 14 ordered files. Supabase
managed Auth/Storage schemas are retained. Migration replay plus strict catalog
verification share one transaction; failure rolls back the reset. The result
records migration hashes and project fingerprint. This command is not a
production upgrade or a whole-project Auth/Storage reset.

7. After successful replay, run provider/application acceptance:

```powershell
node --env-file=.env.gate0.local scripts/phase1-live-acceptance.mjs
```

This refuses mismatched/stale reset evidence or changed migrations, repeats
live catalog verification, verifies signup is disabled, creates only disposable
normal/viewer/inactive/admin/owner identities and identifiable sentinel rows,
then exercises direct RLS denials, protected HTTP reads/mutations, owner access
management, login, real refresh exchange, logout cookie replay, global revocation,
deactivation and compiled secret isolation. Cleanup failures fail acceptance.
Never print the generated credentials or repurpose test users as real staff.

8. Review both reports and repeat local quality checks against the same source
   and build. Record real target identity, UTC timestamps, migration hashes and
   every required result. Only when all nine required results pass may the
   release record say `PHASE 1 - PASS, LIVE VERIFIED`. Current evidence does not
   permit that claim.

## Remaining scope

Atomic reservation/booking/payment/refund workflows, email delivery, scheduling
and booking editors remain unavailable. The current migrations intentionally
do not provide `create_slot_hold` or a payment transition RPC. No new success
path substitutes local state. An existing legacy production database requires
a separate, reviewed data-preserving upgrade plan, not this disposable reset.
Dependency audit findings from the previous baseline remain outside this gate;
local Gate 0 checks do not certify whole-product launch readiness.

Provider references: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions),
[sign-out behavior](https://supabase.com/docs/guides/auth/signout),
[Auth public settings API](https://github.com/supabase/auth/blob/master/openapi.yaml),
[Supabase migration workflow](https://supabase.com/docs/guides/local-development/database-migrations).
