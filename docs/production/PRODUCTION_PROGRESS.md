# G FORCE TYRES - Production recovery progress

Updated: 2026-10-10 (Asia/Dhaka).
Scope: establish baseline, propose canonical architecture, commit documentation only, stop.

## CURRENT HEAD

| Item | Value |
| --- | --- |
| Repository | `gforcetyres506-cell/gforce` |
| Checkout | `E:\Taqi Project\gforce-production-recovery` |
| Working branch | `production/v1-recovery` (local, no upstream configured) |
| Audited application HEAD | `61346440dd64e5dacff31d6e6409236d08d3e6c8` |
| Application baseline subject | `feat: add customer sign in, sign up, and account portal with booking history` |
| Recorded Vercel deployment | `6538357708`, success, environment label `Production`, same application SHA |
| Audit documentation commit | The commit containing these three documents; message `docs(production): establish recovery baseline`. Its parent must be the audited application HEAD. Resolve the final commit SHA with `git log -1`. |
| Main/remote | No main edits and no remote mutations; recovery branch was created locally because it was absent remotely |

The original `E:\Taqi Project\gforce-tyres` checkout is another repository and was left unchanged. Older `docs/PRODUCTION_PROGRESS.md` is retained as historical evidence; use this file for this recovery checkpoint.

## Status boundaries

| Area | Status | Evidence/remaining uncertainty |
| --- | --- | --- |
| Correct repository and clean starting tree | PASS | Remote identity, branch/history and full SHA verified in isolated checkout |
| Architecture inventory | PASS | Ordered migrations, legacy SQL, runtime helpers/types, seeds, scripts and prior docs inspected |
| SCHEMA CONFLICTS | FAIL | Runtime predominantly targets legacy tables/columns; normalized `001-012` declare a different contract |
| MISSING MIGRATIONS | CONFIRMED ABSENT IN REPO | Requested `013`, `014`, `015` absent from current tree and fetched history; no claim about cloud ledger |
| PRODUCTION MOCK PATHS | FAIL | Ungated server/client fallbacks and synthetic successful writes/account creation; explicit production mock flag is insufficient |
| PAYMENT CONFLICTS | FAIL | PaymentIntent vs hosted Checkout vs disabled pay UI; provider-before-persistence; fake phone receipts; incompatible webhook/ledger/resource rules |
| ADMIN GAPS | PARTIAL / RELEASE BLOCKED | Auth/profile guards exist; operational mutations/audit not reliably canonical/durable; provisioning defaults unsafe |
| Customer privacy | FAIL IN SOURCE | Signup auto-confirms email before email-matched history; reference-only confirmation disclosure; management overprojection and missing token lifecycle |
| Canonical architecture | PROPOSED | Migration-backed model with forward-only reconciliation; not implemented or live certified |
| Deployment baseline | PARTIAL | GitHub success record for audited SHA; separate production boolean false; recorded URL redirects to Vercel login |
| Exact cloud database baseline | UNVERIFIED | No cloud database contacted; project identity/ledger/schema/records not attested |
| Production readiness | NOT CLEARED | No live booking/payment/RLS/concurrency/provider acceptance established |

## Completed in this recovery checkpoint

- Ran `git status`, `git remote -v`, `git branch -vv`, `git branch -a`, and `git log --oneline --decorate --graph --all -80` in the intended repository before changes; tree was clean.
- Created only the requested local recovery branch in an isolated clone; preserved the pre-existing checkout.
- Inspected migrations `001-012`, all legacy schema definitions and booking functions, runtime persistence/types, seeds/provisioning/live-test scripts and relevant historical architecture/security/operations reports.
- Searched all requested table/field/migration names and production-risk terms; distinguished input/examples from executed fallback behavior. `localStore` is process/browser memory, `localStorage` had no source hits, and checkout uses session storage.
- Read public GitHub deployment/status/Actions evidence; attempted only safe page reads on the exact recorded deployment. Reached Vercel login, not the application.
- Ran the existing structural security script successfully. Its narrow assertions do not clear the newly identified risks.
- Documented one canonical schema proposal and a staged safe recovery plan, with cloud/provider evidence limits.

## Check results for this task

| Check | Result |
| --- | --- |
| `node scripts/security-check.mjs` | PASS; structural assertions only |
| Requested risk/schema/history inspections | PASS |
| GitHub Actions for audited SHA | No runs found; Vercel status is separate evidence |
| Live application page acceptance | BLOCKED by Vercel authentication; login-page 200 is not PASS |
| Typecheck, lint and build | NOT RUN for this documentation-only task |
| SQL migration execution, live Auth/RLS harness | NOT RUN; would require cloud mutations prohibited by this task |
| Stripe transactions/webhook replay, email delivery and booking/admin mutations | NOT RUN |
| Documentation whitespace and exact staged scope | PASS; `git diff --cached --check`, baseline/branch/origin assertions and exact three-file scope check |
| Final commit identity and clean tree | Verify after commit with `git show --stat HEAD`, `git rev-parse HEAD^` and `git status`; final results are reported with the commit SHA |

## SAFE RECOVERY PLAN and next prerequisite

Full proposal: [00_RECOVERY_AUDIT.md](00_RECOVERY_AUDIT.md). Data contract: [01_CANONICAL_ARCHITECTURE.md](01_CANONICAL_ARCHITECTURE.md).

The next prerequisite for any separately authorized recovery implementation is a **read-only hosted evidence pack**: active domain/deployment SHA, environment names/presence, Supabase project identity, migration ledger/checksums, schema/functions/grants/policies/schedules and sanitized reconciliation counts. Do not treat the protected deployment record, legacy SQL, seed catalogue, historical test passes or the other local repository as a substitute.

Then reconcile/preserve data and history; contain unsafe paths in a reviewed code change; implement canonical forward migrations and callers together; prove replay/upgrade, integrity, authorization and provider behavior on isolated targets; prepare a separately approved production release with backup/restore/reconciliation and rollback evidence. No product expansion is included.

## Authorized output and stop boundary

Only these files belong in the audit commit:

```text
docs/production/00_RECOVERY_AUDIT.md
docs/production/01_CANONICAL_ARCHITECTURE.md
docs/production/PRODUCTION_PROGRESS.md
```

Commit message: `docs(production): establish recovery baseline`.

Application fixes: **NONE**. Migrations added/edited/deleted: **NONE**. Cloud database or business-data changes: **NONE**. Providers/accounts mutated: **NONE**. Push/merge/deploy: **NONE**. Credential values are not reproduced in these documents.

**STOP after the documentation commit and final repository checks.** This audit and its proposed plan do not authorize implementation or production changes.
