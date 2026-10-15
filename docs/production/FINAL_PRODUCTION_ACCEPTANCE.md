# G Force Tyres V1 production acceptance

Date: 2026-10-12

Release branch: `release/v1-production`

Repository SHA: `d823c36` (latest verified executable baseline)
Domain: **BLOCKED — no current custom-domain ownership, DNS or routing evidence**

## Decision

**PRODUCTION READY: NO**

**OWNER HANDOFF READY: NO**

Gate 4 is locally complete, but the first mandatory live gate cannot start. No
authorized disposable Supabase target is configured, so target identity cannot
be attested and no cloud reset, migration, Auth user, deployment or live booking
was attempted.

## Required acceptance matrix

| Acceptance item | Result | Evidence boundary |
| --- | --- | --- |
| Deployment | BLOCKED | No accepted staging or production deployment for `d823c36` |
| Gate A | LOCAL PASS / LIVE BLOCKED | Responsive suite passed locally; physical devices and hosted runtime untested |
| Gate B | LOCAL PASS / LIVE BLOCKED | Fake-success guardrails pass locally; hosted data paths untested |
| Gate 0 live | BLOCKED | Disposable project configuration is missing |
| Gate 1 real data | BLOCKED | No owner catalogue, zones, fitters or approved settings supplied |
| OneAuto | INTENTIONALLY DISABLED | No current account documentation or sandbox credentials supplied; manual tyre size remains the truthful path |
| Gate 2 booking | LOCAL PASS / REMOTE BLOCKED | Native PostgreSQL 12/12; no remote race evidence |
| Remote slot race | BLOCKED | Requires the attested disposable cloud database |
| Remote stock race | BLOCKED | Requires the attested disposable cloud database |
| Gate 3 bank payment | LOCAL PASS / LIVE BLOCKED | Native PostgreSQL 17/17; no real bank or hosted receipt workflow used |
| Gate 4 admin OS | LOCAL PASS / HOSTED BLOCKED | Owner acceptance 3/3; invitation delivery and real owner operation untested |
| Gate 5 security | BLOCKED | Preceding live Gate 0 has not passed |
| Accessibility | LOCAL PASS / DEVICE BLOCKED | Playwright guardrails passed at seven widths; physical devices untested |
| Performance | BLOCKED | No accepted staging URL or production data volume |
| Dependency security | BLOCKED | Release dependency audit/remediation has not run after live Gate 0 |
| Legal | BLOCKED | Terms, privacy, cancellation/refund and consent wording lack owner/legal approval |
| Email | BLOCKED | No verified Resend domain, approved sender/content or live inbox proof |
| Monitoring | BLOCKED | No production alert destinations, incident owner or external uptime proof |
| Backup | BLOCKED | No hosted backup policy/account evidence |
| Restore | BLOCKED | No disposable restore rehearsal |
| Staging E2E | BLOCKED | No accepted staging deployment or provider configuration |
| Controlled live booking | BLOCKED | Live gates and owner data are incomplete |
| Owner operations | BLOCKED | Local workflow passed; no hosted owner acceptance session |
| Account ownership | BLOCKED | Domain, hosting, Supabase, Resend, OneAuto and monitoring ownership are unverified |

## Local acceptance evidence

- Gate 4 native PostgreSQL: 3/3.
- Gate 3 native regression: 17/17.
- Gate 2 native regression: 12/12, including exact 1/19 slot and stock races.
- Database security: 16/16.
- Reliability: 124/124.
- Responsive Playwright: 217/217 at 360, 375, 390, 430, 768, 1366 and 1440.
- Typecheck, production build, security structure and diff check: PASS.
- Lint: PASS with four pre-existing warnings.

Evidence files: [Gate 4 PostgreSQL](evidence/GATE4_POSTGRES.json) and
[Gate 4 quality](evidence/GATE4_QUALITY.json).

## Gate 0 configuration status

Only status was inspected; no value was printed.

| Variable | Status |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | MISSING |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | MISSING |
| `SUPABASE_SERVICE_ROLE_KEY` | MISSING |
| `PHASE1_DISPOSABLE_PROJECT_REF` | MISSING |
| `PHASE1_DATABASE_URL` | MISSING |
| `PHASE1_CONFIRM_DISPOSABLE` | MISSING |
| `PHASE1_ACCEPTANCE_TOKEN` | MISSING |
| `PHASE1_APP_URL` | MISSING |
| `PHASE1_RESET_EVIDENCE_JSON` | MISSING |
| `PHASE1_EVIDENCE_JSON` | MISSING |

Three-way target identity is therefore **NOT PROVABLE**:

`application project = UNKNOWN; authorized disposable project ref = UNKNOWN; database target = UNKNOWN`

## Open release blockers

| ID | Priority | Blocker |
| --- | --- | --- |
| P0-01 | P0 | No explicitly authorized disposable Supabase project or secret-safe Gate 0 configuration; live schema/Auth/RLS/RBAC/session acceptance cannot begin |
| P1-01 | P1 | Owner business data and real bank details are absent |
| P1-02 | P1 | Current OneAuto contract documentation and sandbox credentials are absent |
| P1-03 | P1 | Remote slot, stock and bank-payment workflows are unverified |
| P1-04 | P1 | Resend domain, sender, approved templates and inbox evidence are absent |
| P1-05 | P1 | Legal copy and consent decisions are unapproved |
| P1-06 | P1 | Staging/deployment/domain access and exact-SHA evidence are absent |
| P1-07 | P1 | Performance, physical-device and cross-browser staging acceptance is absent |
| P1-08 | P1 | Monitoring, alert destinations and incident ownership are absent |
| P1-09 | P1 | Backup, restore and rollback rehearsals are absent |
| P1-10 | P1 | Client account ownership, owner training and controlled live-booking evidence are absent |

P0 OPEN: **1**

P1 OPEN: **10**

## Exact human input required to continue

Provide an explicitly authorized **disposable** Supabase project and place the
required Gate 0 values in an ignored local environment file or approved secret
store. Do not paste secret values into chat or commit them. The database URL must
be the direct TLS owner connection for the same project ref; the public URL,
anon key and service-role key must also belong to that project. Set the exact
disposable confirmation only after independently checking the target:
`PHASE1_CONFIRM_DISPOSABLE=I_CONFIRM_THIS_PROJECT_IS_DISPOSABLE`.

Configure the eight variables listed above. Also assign two unused ignored paths
for `PHASE1_RESET_EVIDENCE_JSON` and `PHASE1_EVIDENCE_JSON`. The acceptance app
origin may be a local loopback URL started from this exact branch; the acceptance
token must be a new random value of at least 32 characters.

Once those inputs exist, the automated preflight can attest application project
= authorized project ref = database target before any reset. Later gates will
also require owner-supplied catalogue/zones/fitters/settings/bank details,
current OneAuto documentation and sandbox access, approved legal/email copy,
and client-owned deployment/monitoring/backup accounts.
