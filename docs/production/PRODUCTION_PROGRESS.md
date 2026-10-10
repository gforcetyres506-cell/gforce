# G FORCE TYRES - Production recovery progress

## Gate B - truthful funnel / zero fake production state (2026-10-10)

Branch: `fix/b-truthful-funnel`. Starting HEAD:
`d67b99d7ca1d00da6055d47ed48cb73313abe5c4` (completed Gate A).
This entry supersedes the historical mock-path findings below for this branch.
The full path classification is in [MOCK_PURGE_REGISTER.md](MOCK_PURGE_REGISTER.md).

PRODUCTION FAKE SUCCESS PATHS = 0

### Implemented

- Deleted runtime fictional business records and every local-state database
  substitution. Inventory, settings, coverage, bookings and fitters now require
  successful persistent reads; genuine empty results remain empty.
- Manual Width/Profile/Rim start empty and require three deliberate selections.
  Booking without product/size context returns to the finder. Unknown product
  IDs, unavailable stock and missing prices cannot select another tyre.
  Rear tyres require explicit selection from actual differently sized inventory.
  Optional vehicle/city data stays empty; no plate, Vehicle or BMW is invented.
- OneAuto failure, timeout, unknown data, explicit ambiguity and unlabeled
  alternative fitments return manual entry. Missing load/speed ratings remain
  unspecified.
- Slot GET is read-only; no implicit opening hours/capacity/schedule generation.
  Occupancy read failure cannot become free capacity. Holds require the atomic
  RPC plus a persisted session-owned row and future expiry. Failed/malformed/
  expired holds show the required message and block both Continue and progress
  navigation. No synthetic hold or manual check-then-insert path remains.
- Booking totals use a read-only server quote from validated database stock,
  prices, settings and coverage. Missing/invalid pricing blocks continuation.
  Removed hardcoded fitting/deposit amounts and free location-charge defaults.
- Retired fake checkout/payment confirmation, phone payment receipts, local
  admin changes and synthetic payment UI. Checkout and admin/cancellation
  mutations fail closed without writes; signed relevant Stripe events return
  retryable failure while the verified payment/refund engine is absent.
  Admin now renders the existing unavailable-state component; real auth guards remain.
- Signup uses the actual Supabase verification request; it cannot invent a user,
  mark an unverified address verified, or claim delivery/new account creation
  from an obfuscated auth response. Account/history/sign-out failures remain
  errors. Unpaid bookings have no paid progress; absent fitters are explicit.
- Retired legacy seed/provisioning CLIs before credential loading or network.
  The fictional business seed SQL is empty. All ordered migrations and legacy
  schema.sql are unchanged. No cloud database was accessed or modified.

### Local verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS, including final generated Next route types |
| `npm run lint` | PASS, zero errors; 8 remaining pre-existing warnings |
| `npm run build` | PASS, invoked by Playwright webServer before starting the compiled production application |
| `npm run test:reliability` | PASS, 39/39 isolated tests; real TypeScript helpers, database/provider doubles confined to tests |
| `npm run test:ui` | PASS, 119/119 against compiled production UI at 360, 375, 390, 430, 768, 1366 and 1440px |
| `npm run test:security` | PASS, structural checks; live disposable-project acceptance deliberately not run |
| `git diff --check` | PASS, including the final documentation and staged diff |
| Migrations / schema diff | Empty; only the retired fictional seed file changes under supabase |

UI fixtures are test-only. The compiled server has empty database/provider
credentials; browser API fixtures exercise layout and failures, while direct
API checks exercise actual server 503/404 responses. No hosted booking, payment,
hold, account or inventory mutation is exercised.

### Release boundary

This gate removes false success. It does **not** make commerce launch-ready.
Runtime schema conflicts and absent booking/payment/admin migrations remain
unresolved. Checkout, refunds, online cancellation and admin mutations must stay
unavailable until their canonical persistent workflows are implemented and
verified. A quote or temporary time hold never confirms a booking.

Hosted data/ledger accuracy, approved business prices/contact details,
provider delivery, outstanding Stripe events and physical-device acceptance
remain unverified. Do not infer live production state from these local checks.

Commit message: `fix(production): remove silent fake and default states`.
Local commit only; no push, merge, deployment or production service change.
Stop after commit and clean-tree verification.

---

## Gate A - customer-facing UI safety (2026-10-10)

Scope: the UI safety work explicitly authorized after the documentation-only recovery checkpoint. Branch: `fix/a-ui-safety`. Starting commit: `2d2178bbdaa1b54407a8b3902a104bfd4e1d0ed5`; application source baseline: `61346440dd64e5dacff31d6e6409236d08d3e6c8`. Audit input: workspace `GFORCE_UIUX_AUDIT.md`, which identifies the same repository and application SHA.

### Implemented

- Booking uses a single mobile grid column, zero-minimum desktop tracks, shrinkable inputs/cards and wrapping/stacked actions. Removed body overflow clipping as a workaround; summary sticks only on desktop.
- Public navigation and footer no longer advertise Staff, Operator Login, Admin Dispatch Console, Staff Portal or customer sign-in. `/admin/login` is retained. The mobile menu supports Escape, focus trapping and focus restoration.
- One contact component serves desktop header, hero, mobile drawer, mobile bottom bar, footer and relevant error/empty states. Only explicit `BUSINESS_PHONE` and independently configured `BUSINESS_WHATSAPP` are accepted, in international format. Missing/invalid values render no contact link. No approved business number was supplied; no default was invented. Legacy settings/mock phone values are never used by this component. Redeploy after contact configuration changes so static pages are regenerated.
- Removed the manage page's fictional technician phone card and sample dispatch number. Cancellation, refund, booking persistence and payment behavior were not changed.
- Bebas Neue and Inter load through `next/font`, with self-hosted generated font assets and swap behavior. Display fonts no longer depend on Windows font availability.
- Budget / Standard / Premium badges use literal classes. The existing database `mid` value maps to Standard in presentation, including the inventory label; database enums and queries retain their existing contract. Catalogue links use `tier=standard`, translated at the existing query boundary.
- Raised shared helper/placeholder/disabled text contrast, retained visible focus, set customer captions to at least 12px, and expanded critical actions to at least 44px. Added named quantity controls, visible/named progress steps with `aria-current`, form labels and customer autofill attributes.
- Added distinct metadata for home, tyres, booking, management and legal pages; management is noindex. Added a branded 404 with recovery and configured contact links.
- Corrected catalogue price copy to say per tyre and identify separate fitting/location charges; all price calculations and payment logic are unchanged.

### Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS, including UI test sources |
| `npm run lint` | PASS, zero errors and 56 existing warnings |
| `npm run build` | PASS with database credentials and business contacts unset |
| Playwright / axe guardrails | PASS, 42/42 tests against compiled production UI at 360, 375, 390, 430, 768, 1366 and 1440px |
| Contact configuration absent | PASS, 7/7 additional production page tests at the same widths; no `tel:`/WhatsApp links or sticky contact bar |
| Structural security script | PASS; does not establish hosted authorization or payment correctness |
| `git diff --check` | PASS after whitespace review |
| Commit scope | Reviewed: UI, contact presentation/configuration, test infrastructure and this progress entry; no migrations, database helpers or API/payment behavior changes |

The Playwright server builds locally with reserved fictional contact values supplied **only by test configuration**. Browser API requests are fulfilled with local fixtures before navigation, including `/api/slots`, holds and management. Database/provider credentials are unset. The existing server catalogue fallback is observed for rendering checks; it is not asserted to be business stock. Tests stop before checkout and do not exercise live payments or cancellation.

UI verification is separate from hosted acceptance and does not clear the recovery audit's schema conflicts, unsafe mock persistence, payment conflicts, privacy gaps or legal approval requirements. Dependency installation reported 19 audit findings (3 moderate, 14 high, 2 critical); dependency remediation is outside this UI gate.

Commit message: `fix(ui): resolve production mobile and public UX blockers`. No push, merge, deploy, migration, cloud database write, or production business-data change is included. Stop after the local commit and clean-tree verification.

---

## Historical documentation-only recovery checkpoint

Updated: 2026-10-10 (Asia/Dhaka).
Scope: establish baseline, propose canonical architecture, commit documentation only, stop.

## CURRENT HEAD (historical recovery snapshot)

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
