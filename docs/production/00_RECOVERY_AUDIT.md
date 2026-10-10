# G FORCE TYRES - Recovery baseline audit

Audit date: 2026-10-10 (Asia/Dhaka). Scope: inspection and documentation only.

## Release decision

**Repository baseline: PASS. Architecture consistency: FAIL. Exact live database baseline: UNVERIFIED. Production release clearance: WITHHELD.**

The application contains two incompatible SQL designs and a third, synthetic in-memory data source. Ordered migrations are the proposed canonical foundation, but current server code largely targets the legacy schema. Database errors and empty results can be presented as demo data or successful writes. A successful deployment status or the existing security script does not establish safe booking, payment or customer-data handling.

This audit changes no application code, migration, business data, environment configuration or cloud database. Findings below are source-confirmed unless explicitly labelled as deployment evidence, historical claims or unverified conditions.

## CURRENT HEAD and repository verification

| Item | Verified result |
| --- | --- |
| Repository | `gforcetyres506-cell/gforce` (GitHub repository ID `1376799861`) |
| Origin fetch/push | `https://github.com/gforcetyres506-cell/gforce.git` |
| Audited HEAD before documentation commit | `61346440dd64e5dacff31d6e6409236d08d3e6c8` |
| Application tree at audited HEAD | `6a021deb513e3e065b49c69b574400558b87c7f5` |
| HEAD subject | `feat: add customer sign in, sign up, and account portal with booking history` |
| HEAD commit date | `2026-09-19T13:18:26+06:00` |
| Audit checkout | `E:\Taqi Project\gforce-production-recovery` |
| Working branch | `production/v1-recovery` |
| Initial working tree | Clean: `nothing to commit, working tree clean` |
| Remote branches observed | `origin/main` only; remote HEAD points to `main` |
| Recovery branch origin | Created locally from the verified `origin/main` commit because the requested recovery branch did not exist remotely |
| Upstream | Inherited `origin/main` tracking removed from the new recovery branch to avoid an accidental main-targeted operation |
| Remote mutation | None; no push, PR, merge or deployment |

The initial workspace checkout, `E:\Taqi Project\gforce-tyres`, was clean but pointed to **`t4j44/G-force-Tyres-mobile`**, branch `gate/0-live-supabase`, HEAD `c72d225e824d112ea109a26579af3baab6dee324`. It is a different repository and was left unchanged. Its additional history is not evidence that migrations exist in the requested repository.

Executed in the correct checkout before editing:

```text
git status
git remote -v
git branch -vv
git branch -a
git log --oneline --decorate --graph --all -80
```

The complete observed target history contains 12 commits:

```text
6134644 feat: add customer sign in, sign up, and account portal with booking history
3a844c8 docs: add comprehensive production deployment and operations guide
560dbe9 feat: add admin operator user provisioning CLI script
142f315 feat: add Supabase database seeding script
eae7a48 feat: complete backend API routes, database persistence layer, and Vercel compatibility
0dfa229 docs: update production progress HEAD pointer
6ddcb37 feat: implement client visual refinement and initialize master production progress
8945083 feat: refine branding and hero positioning
5bbf897 docs: add production audit and Gate 0 evidence
c85d70f test: add gated live Supabase acceptance controls
898a785 review: preserve Phase 0-1 hardening baseline
e13bbae chore: pre-production audit baseline
```

After the documentation commit, Git HEAD advances by one documentation-only commit. The full SHA above remains the audited application baseline; the audit commit is identified by `git log -1` and its parent by `git rev-parse HEAD^`.

## Deployment evidence and its limits

Read-only GitHub queries on the audit date found:

- [Commit status](https://api.github.com/repos/gforcetyres506-cell/gforce/commits/61346440dd64e5dacff31d6e6409236d08d3e6c8/status): Vercel `success`, recorded at `2026-09-19T07:19:42Z`.
- [Latest deployment metadata](https://api.github.com/repos/gforcetyres506-cell/gforce/deployments?per_page=100): deployment `6538357708`, SHA equal to the audited HEAD, environment labelled `Production`. The separate `production_environment` boolean is `false`; the label alone must not be treated as full production attestation.
- [Deployment status](https://api.github.com/repos/gforcetyres506-cell/gforce/deployments/6538357708/statuses): `success`, pointing to [the recorded deployment](https://gforce-ijy920rk6-g-force2.vercel.app) and [Vercel deployment details](https://vercel.com/g-force2/gforce/CNgriXU1Paa2vuhUATP9eb1AMWUb).
- [GitHub Actions runs for this SHA](https://api.github.com/repos/gforcetyres506-cell/gforce/actions/runs?head_sha=61346440dd64e5dacff31d6e6409236d08d3e6c8&per_page=20): `total_count: 0`.

Unauthenticated GET requests to the recorded deployment's `/` and `/booking/pay` both followed redirects to **Vercel login**. The final HTTP 200 was the login page, not the application. No application behavior was verified. No booking, slot, signup, checkout or payment API was called; notably, `/api/slots` can write data even on GET.

**Known:** the repository commit and a successful deployment record for that commit. **Unknown:** current custom-domain routing, active Vercel alias/promotion, environment-variable configuration, Supabase project identity, applied migration ledger, actual tables/functions/grants, existing real records, Stripe mode/webhook registration and provider delivery. No cloud database was contacted. An exact live database baseline cannot be inferred from the GitHub deployment record.

## Architecture versions found

| Version | Source | Observed authority and compatibility |
| --- | --- | --- |
| Normalized V3 SQL foundation | `supabase/migrations/001_extensions.sql` through `012_indexes.sql` | 19 tables, split product/inventory model, payment/event ledgers and RLS. Proposed canonical foundation; execution against the live database is unverified. |
| Legacy monolithic SQL | `supabase/schema.sql` | 14 tables, combined `tyre_inventory`, legacy field names, booking-embedded payment fields and legacy booking RPCs. Competes with V3 and is promoted by `PRODUCTION.md:75-97`. |
| Legacy runtime persistence | `src/lib/db.ts`, `src/lib/pricing.ts`, `src/types/index.ts`, account and webhook routes | Mostly matches monolithic SQL; does not implement the migration contract. Added persistence does not mean successful durable persistence. |
| Synthetic runtime state | `src/lib/mockData.ts:511-608,832` | `LocalBookingStore` constructs demo stock, future slots and a demo booking in separate process/browser memory. Not a database and not shared across serverless instances. |
| Seed-driven operations | `supabase/seed.sql`, `scripts/seed-supabase.mjs` | Write the legacy shape using sample products, prices, stock, zones and fitters; no evidence these are owner-approved business facts. |
| Conflicting operational narratives | `README.md`, `docs/PHASE1_REPORT.md`, `docs/final-production-audit/`, `docs/PRODUCTION_PROGRESS.md`, `PRODUCTION.md` | Older reports describe disabled commerce; later operations guide claims enabled legacy persistence. Neither describes all current risks accurately. |

No separate `src/lib/localStore*` file exists. `localStore` is exported from `mockData.ts`. No `localStorage` occurrence was found in the inspected source; checkout uses **`sessionStorage`**, which lasts for a browser tab/session and is not authoritative persistence.

## SCHEMA CONFLICTS

Paths and line numbers below refer to the audited application commit.

| Domain | Ordered migration contract | Legacy/runtime contract | Failure consequence and source evidence |
| --- | --- | --- | --- |
| Catalogue and stock | `tyre_products` + `inventory`; `stock_qty`, `reserved_qty`, `cost_price_pence`, `selling_price_pence` (`005`) | `tyre_inventory`; `stock`, `cost_price`, `sell_price` | Catalogue/pricing/admin queries address a table absent from migrations (`db.ts:31,69,86,106,142`; `pricing.ts:78`). Empty matches also trigger demo fallback. |
| Product attributes | `run_flat`, `extra_load`, `wet_grip_rating`, `fuel_efficiency_rating`, required unique `slug` (`005`) | `is_run_flat`, `is_xl`, `wet_grip`, `fuel_economy`; no slug | Type assertions do not translate database rows. Product create payload is incompatible. |
| Slots | `date`, `start_at`, `end_at`, `capacity`; unique `(date,start_at,end_at)` (`006`) | `slot_date`, `start_time`, `end_time`, `max_bookings`; conflict key `(slot_date,start_time)` | Reads, capacity changes and upserts fail or fall back (`db.ts:160-229,352-411`). |
| Slot holds | Unique `token` (`007`) | `session_token`; RPC parameters `p_session_token` | Lookup/insert/release do not match migrations (`db.ts:232-349`). |
| Inventory holds | `inventory_holds` linked to a slot hold and product (`007`) | Unused by runtime; stock is checked separately | No durable multi-product reservation/concurrency control. |
| Bookings | `reference`, `registration`, `postcode`, `service_zone_id`, money fields ending `_pence` (`008`) | `booking_ref`, `vehicle_reg`, `fitting_postcode`, `tyres_total`, `total_amount`, etc. | Insert/read/search mismatch; runtime also writes Stripe columns absent from migration bookings (`db.ts:450-495,506-621`). |
| Line items | `tyre_product_id`, four required snapshot fields, `unit_price_pence`, `line_total_pence` (`008`) | `tyre_id`, `tyre_label`, `unit_price`, `line_total` | Missing required snapshots and wrong column names; item insert error is ignored (`db.ts:484-495`). |
| Customers | Required `first_name`, `last_name`, phone; email has a nonunique lower-case index (`003`,`012`) | `name`, address columns, unique-email upsert | Upsert conflict target and payload are incompatible (`db.ts:424-446`; signup `route.ts:80-109`). No Auth-user linkage exists in either SQL design. |
| Service zones | `name`, `callout_fee_pence`, `priority` (`004`) | `zone_name`, `callout_charge` | Raw normalized rows cannot supply runtime charge/name fields (`postcodes.ts:34-71`; checkout `route.ts:67`). |
| Settings | `business_settings`; `deposit_mode` + `deposit_value` (`010`) | `app_settings`; separate fixed/percent deposit fields and fitting fee | Two settings helpers read the missing legacy table and return mocks (`db.ts:783-806`; `pricing.ts:19-41`). V3 also lacks an explicit fitting-fee field needed by the current journey. |
| Payment/event records | Separate `payments`, `webhook_events` (`009`) | Stripe IDs and paid timestamp on `bookings`; runtime never uses the normalized ledgers | Missing durable provider-event/payment reconciliation. |
| Audit | `audit_logs(admin_user_id,resource_type,resource_id,metadata)` (`010`) | `db.recordAudit` writes `audit_log(actor,entity,entity_id,metadata)` | Current mutations use the legacy writer; normalized `writeAuditLog` has no callers (`db.ts:809-832`; `audit.ts:14-28`). |
| VRM cache | `lookup_hash`, `encrypted_payload`, expiry (`010`) | Legacy SQL has raw `registration`, JSON payload, cache time; current lookup does not use either cache | No implemented encrypted/expiring cache (`oneauto.ts:95-163`). |
| Rate limiting | No `rate_limits` table in `001-012` | Runtime queries that table and permits requests on error | Missing/racing durable limit; rate limiter fails open (`rateLimit.ts:19-43`). |
| RLS | Restricted anonymous product/zone columns; protected data for active admins (`011`) | Legacy SQL adds broader row policies for slots/settings/catalogue and a different self-profile policy | Applying both scripts is not a safe merge. `IF NOT EXISTS` does not reconcile existing columns; leftover policies/functions are not automatically removed. |

## MISSING MIGRATIONS

The directory has exactly these 12 ordered files, with no numeric gap within `001-012`:

```text
001_extensions.sql       002_admin_profiles.sql   003_customers.sql
004_service_zones.sql    005_catalogue.sql        006_availability.sql
007_booking_resources.sql 008_bookings.sql       009_payments.sql
010_operations.sql      011_rls.sql              012_indexes.sql
```

| Requested file | Current tree | All fetched target-repository history | Meaning |
| --- | --- | --- | --- |
| `013_gate2_booking_engine.sql` | Absent | No path found | Booking engine recovery migration is not delivered here. |
| `014_gate3_stripe_webhook_email.sql` | Absent | No path found | Payment/webhook/email recovery migration is not delivered here. |
| `015_gate4_admin.sql` | Absent | No path found | Admin recovery migration is not delivered here. |

Exact-name/content searches and `git log --all` path searches found no evidence these files ever existed in the fetched target history. This does **not** prove deletion, existence in another repository, or presence/absence in a cloud migration ledger.

`create_slot_hold`, `confirm_booking_paid`, `refund_booking`, reference generation and expiry cleanup exist only in legacy `schema.sql`, not the ordered migrations. The normalized tables alone do not implement those transactions. Durable email delivery state, an atomic rate limiter and secure customer-account linkage also have no migration implementation. `scripts/security-check.mjs:9-27` hardcodes exactly 12 migration filenames; a later approved migration requires updating that check rather than discarding existing migration history.

## PRODUCTION MOCK PATHS

Production-reachable below means the source has no effective mock-only gate on that path. It is not a claim that the protected deployed application was exercised.

| Path | Trigger/behavior | Production assessment |
| --- | --- | --- |
| `db.ts:21-155,160-229,232-349,506-621` | Missing credentials, query errors, missing rows, and for some reads valid empty results lead to `localStore` | Ungated demo catalogue, availability, holds and booking reads. Valid zero inventory is not respected. |
| `db.ts:100-155,352-418,450-503,623-648,728-806` | Mutates a local mirror, ignores some database errors, returns success or synthetic objects | False durable-write success; `createTyre` can return a synthetic object without even adding it to the local store. |
| `api/slots/route.ts:15-21` | Public GET can call `generateSlots` when the result is empty | Read request may create business availability using hardcoded rules. Do not use it for a supposedly read-only production smoke check. |
| `pricing.ts:19-41,74-94`; `postcodes.ts:34-49` | Missing/empty/error settings, catalogue or zone reads | Fictional prices, deposit rules, coverage or charges can enter checkout. |
| `oneauto.ts:95-139` via `api/vrm/lookup` | Provider unavailable/unconfigured; sandbox dictionary or any sufficiently long registration | Generic BMW/225/45 fitment can be labelled `source: 'oneauto'`; no mock guard inside helper. VRM route still has Turnstile checks, so reachability depends on those passing. |
| `booking/page.tsx:194-207,214-220,264,280-294` | Failed hold request creates client-side hold ID; blank registration becomes `AB21ABC`; fixed displayed fees | Invented reservation/vehicle and unauthoritative pricing. Session storage contains checkout/contact data and provider/manage secrets. |
| Admin inventory/bookings/slots pages | API failure returns browser-local store; some writes update UI without checking HTTP/application success | Operators can see apparent stock/job/schedule changes that never persisted. |
| `admin/(protected)/bookings/page.tsx:195,285`; `manage/[token]/page.tsx:81,264` | Fitter lookup/selection uses `MOCK_FITTERS` unconditionally; manage page substitutes first demo fitter for some statuses | Fictional technician assignment/contact; hardcoded dispatch number `020 7946 0991`. |
| `api/admin/slots/update/route.ts:43-58` | Toggle slot, block/unblock date | Local-memory mutation even with mock mode disabled; no persistent blocked-date write. |
| `api/account/signup/route.ts:110-122` | Supabase public configuration missing | Returns successful signup with a synthetic local user ID. |
| `api/checkout/create/route.ts:100-101,155-189` | Missing/placeholder Stripe key or Stripe error | Synthetic payment IDs and `demo_secret_*`; successful API response can disguise provider failure. |
| `api/admin/bookings/route.ts:113-122` | Assisted booking creation | Immediately marks confirmed/deposit paid, using `phone_*` / `phone_staff_*` instead of a real payment record. |
| `mockData.ts:542-608,832` through ungated `db.getBookingByToken` | Module import creates known demo record; missing real token match falls back to it | Demo management record can be returned by the production-source API path. No live API was called to prove deployment exposure. |

Actual controls still present: `next.config.mjs:2-19` rejects production with `ENABLE_MOCK_DATA=true`; `checkout/confirm-mock` returns 404 when mocks are off; `/booking/pay` renders **PAYMENTS ARE NOT LIVE YET** when mocks are off; the confirmation page's local-store fallback is gated. These controls do not cover the ungated server helpers or all admin/client fallbacks.

Searches included every requested risk term. `225/45`, BMW styling references, input `placeholder` attributes, and React `Suspense fallback` are not automatically fake business records. The dangerous occurrences are the executed assignments, sample-data fallbacks and false-success paths identified above.

## PAYMENT CONFLICTS

1. **Different integration designs:** normalized SQL and historical requirements support a separate payment ledger and hosted Stripe Checkout; current create route uses PaymentIntents; the customer pay page contains only a guarded mock card form. There is no usable non-mock customer payment UI at this HEAD.
2. **Provider call before durable booking:** checkout creates the Stripe intent at lines 160-173, then calls `createBooking` at line 180. The helper can ignore failed customer, booking and item writes. Provider metadata uses a temporary non-UUID booking ID before the database generates a different ID. No Stripe creation idempotency key or durable attempt reconciliation is supplied.
3. **False provider success:** `demo_secret_*` survives missing keys or exceptions. `is_mock_payment` tests the key shape, not whether intent creation succeeded; a configured-key failure can report `false` while returning a demo secret.
4. **Webhook/schema mismatch:** signature verification exists, but the success branch calls legacy-only `confirm_booking_paid`; failure updates booking-embedded Stripe columns; refunds call legacy-only `refund_booking`. The normalized `payments` and `webhook_events` are unused. Refund RPC and failed-payment update errors are not inspected before acknowledgment (`api/stripe/webhook/route.ts:70-97`).
5. **Unsafe resource accounting:** `db.createSlotHold` falls back to a read/count/insert sequence, not one locked transaction. Missing/expired holds may be bypassed when a slot appears available. Pending booking plus its live hold can be double-counted. Inventory is not reserved with slots. The helper's manual confirmation lacks an already-paid guard, clamps stock at zero and deletes all holds on the slot. It is used by the guarded mock-confirm endpoint, not by the Stripe webhook. Legacy RPCs also delete all slot holds and clamp stock rather than proving sufficient reservation.
6. **Phone payment fabrication:** assisted booking sets `confirmed` and `deposit_paid_at` without receipt evidence, reserve transaction or capacity validation. Admin PATCH can also set a paid-looking status without a guarded state transition.
7. **Cancellation/refund disagreement:** cancellation helper restores stock without proving stock was consumed, does not refund Stripe and is not atomic/idempotent under concurrent requests. The management API checks some statuses but not the configured notice window. Legacy refund logic treats `charge.refunded` as full refund and restores all stock; partial refunds are not modelled safely.
8. **Email is not durable:** webhook starts notification with `void`; Resend absence/errors are swallowed and API error results are not inspected. No outbox/retry/delivery ledger exists. Sender defaults to a development address and links default to localhost (`email.ts:7-32`). Duplicate events can repeat notification even when legacy booking confirmation is a no-op.
9. **Ledger extension needed:** `009_payments.sql` makes PaymentIntent ID globally unique per payment row; a separate refund row cannot reuse that ID without a clarified parent-payment/refund-reference model.

## ADMIN GAPS and customer-data risks

| Area | Existing control | Remaining gap |
| --- | --- | --- |
| Admin access | `requireAdmin` verifies Supabase user and active owner/admin profile; protected layout and mutation routes invoke it | Live Auth/RLS/session tests not established for this target. Owner/admin mutation permissions are not differentiated. |
| Inventory | Protected list/create/update endpoints and screen | Legacy schema; arbitrary numeric/default product facts; ignored write results; no conflict-safe stock reservation; price/activation/import workflows incomplete. API permits stock writes independently of live commitments. |
| Bookings | Protected list, PATCH, assisted creation | Weak request/status validation; false paid status; no transactional capacity/stock check; demo fitter list; no persistent audited refund/reschedule workflow. |
| Slots | Protected generation/update endpoints | Hardcoded schedules; submitted `days` and block `reason` are not carried into durable rules; block/toggle local only; active-only listing limits reopening blocked slots. |
| Operations | V3 tables for zones, fitters, settings, audit | No corresponding management pages/routes in current route tree; unused `getFitters` does not supply the UI. Existing scope must be agreed before adding screens. |
| Audit | Normalized `writeAuditLog` exists | Current mutation handlers use legacy best-effort writer, sometimes generic `admin` actor; data changes and audit records are not one guaranteed operation. |
| Admin provisioning | `scripts/create-admin.mjs` can create/update Auth and profile | Committed default password, password printed to stdout, existing password overwritten, every profile promoted/reactivated as owner. Do not run it. If the default was ever used, require an owner-managed credential/access review; usage is unverified. No password value is reproduced here. |
| Customer identity | Login verifies a Supabase password session | Public signup sets `email_confirm: true`; `/api/account/me` links history by email. Someone registering an unclaimed guest customer's email could gain that customer's history without proving mailbox ownership. The failure depends on existing data and configuration; no exploit was attempted. |
| Confirmation access | Server-side booking lookup | `/confirmation/[ref]` needs only a six-digit reference, shows contact/address/vehicle details and exposes the management link. A booking reference is not sufficient authorization. No ownership/token gate or rate limit is present. |
| Management access | UUID capability token on real bookings | `select('*')`/joins are returned directly, including internal notes and unnecessary fields; no token expiry/revocation or request limit; demo fallback; cancellation policy not enforced. |
| Public catalogue | RLS restricts direct anonymous access under V3 | `/api/tyres` uses a service-role `select('*')` and returns it unchanged, exposing `cost_price` on a working legacy schema or demo fallback. API projections must independently enforce public fields. |

These are release blockers in source. Actual customer impact, use of the default admin credential and deployed database contents remain unverified.

## Documentation and script reliability

- `README.md:11-13,64-66`, `docs/MOCK_DATA_AUDIT.md`, and the older final audit claim commerce is fail-closed. Commit `eae7a48` removed multiple route gates and relaxed production environment validation; those claims are stale at this HEAD.
- `PRODUCTION.md:75-97` names legacy `schema.sql` and recommends production seeding; `:153-159` recommends pushing `main`. These instructions conflict with this recovery scope and the canonical migration decision. Do not execute them as a recovery runbook.
- `docs/PRODUCTION_PROGRESS.md` still names `visual/client-refinement` and `6ddcb37`; the historical live report records a failed disposable-target attestation, not evidence for the requested repository's production database.
- `scripts/seed-supabase.mjs` ignores Supabase error results, can overwrite stock/prices/availability from samples, and prints success anyway. `supabase/seed.sql` targets legacy tables. Neither was executed.
- `scripts/phase1-live-acceptance.mjs` creates/deletes Auth users and private fixture rows despite its test name. It was inspected but not executed under the no-cloud-database-mutation instruction.

## Verification performed

| Check | Result | Boundary |
| --- | --- | --- |
| Correct repository, branch, full history and initially clean tree | PASS | Fresh isolated clone; remote refs read without modifying GitHub |
| Architecture/risk searches and migration/history inspection | PASS | Current source evidence, not SQL execution |
| `node scripts/security-check.mjs` | PASS | Existing structural assertions only; does not test current persistence, payment, account ownership or fallback reachability |
| Documentation scope and `git diff --cached --check` | PASS | Exactly the three requested new documents staged; no application/migration edits or other untracked files |
| GitHub deployment/commit status | PASS for recorded metadata | Successful recorded deployment at audited SHA; current alias/database unverified |
| Application HTTP read | BLOCKED by Vercel authentication | Login-page 200 is not application acceptance |
| Typecheck, lint, Next.js/Cloudflare build | NOT RUN | Documentation-only audit; historical passes not reused as current results |
| Live Supabase/schema/RLS, Stripe, Resend, concurrency and E2E | NOT RUN | No database/provider mutation or test transaction authorized in this task |

## SAFE RECOVERY PLAN - proposal only

1. **Pin the actual hosted state before implementation.** Obtain read-only evidence of active domain-to-Vercel-deployment mapping, immutable SHA, environment names/presence, Supabase project identity and migration ledger. Obtain a schema-only export covering columns, constraints, functions, grants, policies and schedules, plus sanitized counts needed to detect orphaned/duplicate records. Do not export customer secrets or change the cloud database. Record any drift from this audit.
2. **Preserve and reconcile.** Preserve `001-012`, legacy SQL and all useful history. Compare live structure/ledger/checksums with both designs; determine whether the database is normalized, legacy or mixed. Create a reviewed ID-preserving mapping and reconciliation plan for customers, bookings, stock and provider receipts. Never infer receipt/payment or inventory truth from demo values. Do not run `IF NOT EXISTS` scripts over an unknown database as a repair.
3. **Contain unsafe paths in a separately authorized code change.** Return explicit unavailable/errors for failed persistence/provider configuration; prevent synthetic production data, false paid statuses, unauthenticated confirmation disclosure and unverified-email history access. Keep real commerce closed until accepted. No containment change is implemented here.
4. **Implement one migration-backed contract only after authorization.** Follow [01_CANONICAL_ARCHITECTURE.md](01_CANONICAL_ARCHITECTURE.md). Add forward migrations after ledger reconciliation; update server/types/mappers/routes and the hardcoded migration checker together. Preserve the frontend design; replace persistence contracts rather than rebuilding the product.
5. **Prove behavior on an isolated local or explicitly authorized disposable target.** Test fresh migration replay and upgrade of a sanitized legacy/mixed snapshot; rollback preservation; Auth/RLS and two-customer isolation; zero/empty/error states; 20 concurrent attempts at one slot and last stock; duplicate/out-of-order webhooks; payment failures, refunds, expiry and email retries; admin mutation/audit persistence. Fixtures must be labelled test-only.
6. **Separate release approval from code completion.** Prepare reviewed deployment/database-change scope, backups with a demonstrated restore, reconciliation, compatibility and application rollback plan. A database rollback must not destroy already-created financial records. Production data imports, migrations, credential rotation, pushes, merges and deployments require separate explicit authorization.

**Stop condition for this task:** commit only the three documents in `docs/production/` with `docs(production): establish recovery baseline`, verify the tree is clean, then stop. No fixes or new features are authorized by this plan.
