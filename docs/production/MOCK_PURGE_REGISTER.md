# Gate B - truthful funnel / mock purge register

Gate 1 update (2026-10-10): no owner business records or account credentials
were supplied. The speculative OneAuto request/response parser is retired;
vehicle lookup remains manual until the current account contract is verified.
Exact outward-code coverage replaces broad prefix matching. Imports require
explicit owner data; migration 015 contains no business seed records. Public
Cloudflare test sitekeys and widget/provider responses exist only in Playwright
configuration/tests. PostgreSQL import rows remain TEST_ONLY_SAFE. Source
scan still finds PRODUCTION FAKE SUCCESS PATHS = 0; live data remains unverified.
See [03_GATE1_REAL_DATA.md](03_GATE1_REAL_DATA.md).


Gate 0 update (2026-10-10): runtime queries now use ordered migrations 001-014;
the legacy schema is archived. PostgreSQL test identities/rows in
`tests/database/gate0.test.mjs` and key-shaped values in
`tests/reliability/admin-boundary.test.mjs` are TEST_ONLY_SAFE. Cloud sentinel
records in the acceptance harness remain gated by disposable-target attestation
and a matching fresh reset report. Historical pricing defaults are blocked by
`pricing_configured=false`. No reservation/payment/email success path was
enabled. PRODUCTION FAKE SUCCESS PATHS = 0 remains the local source finding;
cloud contents are unverified. See [02_GATE0_ACCEPTANCE.md](02_GATE0_ACCEPTANCE.md).

Date: 2026-10-10. Repository: gforcetyres506-cell/gforce.
Branch: fix/b-truthful-funnel. Starting HEAD: d67b99d7ca1d00da6055d47ed48cb73313abe5c4.

This is a local source/runtime audit. It does not attest to deployed code, the
contents of a hosted database, business approval of persisted settings, or a
successful real provider transaction.

## Search and classification

Searched application, scripts and tests with case-insensitive matching for:
mock, MOCK, fixture, sample, demo, placeholder, fallback, localStore,
localStorage and fake. Also traced 225/45/18, AB21ABC, generic vehicle/BMW,
first-product/rear-product selection, synthetic holds/payment IDs, fitter and
phone defaults. Supabase seeds and SQL were inspected separately.

| Classification | Location / former behavior | Gate B disposition |
| --- | --- | --- |
| PRODUCTION_BLOCKER | src/lib/mockData.ts; db.ts silently substituted catalogue, slots, fitters, settings and bookings; mutations reported memory-only success | Deleted runtime fictional records and all imports. Database errors propagate. Empty persistent results stay empty. |
| PRODUCTION_BLOCKER | pricing.ts substituted stock and settings, including fixed fitting/deposit amounts | Validated database settings/inventory only; no quote on missing/invalid data. Duplicate cart lines aggregate before stock checks. |
| PRODUCTION_BLOCKER | postcodes.ts supplied seed zones and accepted provider failure as a valid postcode | Real provider validation and database zones required. Missing charge/invalid zone is unavailable, never free. |
| PRODUCTION_BLOCKER | oneauto.ts returned sandbox vehicles or generic BMW for arbitrary registrations; inferred axles from option order | Removed generated vehicles. Unknown, unavailable, timeout and ambiguous options require manual size. Two fitments require explicit front/rear labels. Missing ratings remain unspecified. |
| PRODUCTION_BLOCKER | TyreFinder.tsx started manual selection at 225/45/18 and supplied 95/Y ratings | Empty Width/Profile/Rim; action disabled until all selected. No rating defaults. |
| PRODUCTION_BLOCKER | booking/page.tsx supplied default dimensions, first product, fallback rear tyre, AB21ABC, Vehicle, London, seed coverage, fake hold and hardcoded pricing | Explicit product/size entry required; no-context redirect to finder; invalid ID errors; deliberate rear selection; empty optional vehicle/city; server quote only. |
| PRODUCTION_BLOCKER | createSlotHold fell through from RPC failure to non-atomic/manual/local writes; release caught failure as success | RPC plus session-owned persistent readback required. No local/manual hold. Failed create/release stays failed. UI uses actual expiry and invalidates expired holds. |
| PRODUCTION_BLOCKER | GET /api/slots manufactured a schedule when none existed | Strictly read-only. Empty schedules remain unavailable. Occupancy-query errors cannot imply free capacity. |
| PRODUCTION_BLOCKER | checkout/create returned demo_secret and fabricated booking/customer/payment IDs, including after Stripe failure | Returns 503 before database/provider writes. Verified atomic booking/payment engine is absent; no replacement feature built. |
| PRODUCTION_BLOCKER | confirm-mock could confirm real records from a test flag | Retired endpoint always returns 404, including development. No database/email imports. |
| PRODUCTION_BLOCKER | payment page rendered synthetic card flow, guessed totals and reset 15-minute clock | Removed synthetic form and browser state. Existing production payment-unavailable behavior now applies in every environment. |
| PRODUCTION_BLOCKER | Stripe webhook acknowledged unchecked failed/refund writes or missing confirmation results | Signed relevant payment/refund events return 503 until verified engine exists, preserving retries. Unhandled event receipt is only a delivery acknowledgement. No booking transition or email dispatch. |
| PRODUCTION_BLOCKER | Admin clients loaded local records; phone booking invented paid receipts, profile/location and confirmed status; slot mutations only changed memory | Retired unsafe operational UIs; they now render the existing AdminDataPending component. Authenticated mutations return 503 with no writes; real reads fail closed. |
| PRODUCTION_BLOCKER | account/signup invented local user and marked email verified without verification; account reads ignored database errors | Real Supabase signup/verification request only; generic receipt avoids claiming new-user creation or email delivery. No privileged auto-verification or unverified customer upsert. Profile/history errors return unavailable. |
| PRODUCTION_BLOCKER | Confirmation treated cancelled/refunded as booked; manage treated pending as paid/completed first step and implied stock loaded | Explicit status presentation and recorded payment evidence required; pending has no completed step. Missing fitter says Fitter not assigned yet. No stock-return/refund success promise. |
| PRODUCTION_BLOCKER | Legacy seed CLI/SQL supplied fictional fitters, phones, stock, prices, zones and schedules; admin CLI supplied implicit identity/password | Seed/admin scripts retired before credentials or network; seed.sql intentionally empty. No schema/migration deleted or edited. No cloud script executed. |
| TEST_ONLY_SAFE | tests/ui and tests/reliability inventory, contact numbers, holds, vehicles and database/provider doubles | Fixtures exist only under tests or Playwright configuration. Production has no test injection flag. Browser fixtures and isolated helper doubles never reach providers. |
| TEST_ONLY_SAFE | scripts/phase1-live-acceptance.mjs fixture rows | Existing explicit disposable-project acknowledgement and application target attestation remain. Not run: this task forbids cloud database modification. |
| TEST_ONLY_SAFE | scripts/security-check.mjs negative mock assertions | Read-only structural checks and deliberately rejected unsafe config. Not business records. |
| DEV_ONLY_SAFE | env.ts, env.server.ts, mock-mode.ts, next.config.mjs mock flag terminology | Safety/configuration compatibility only. Production still rejects an enabled flag; no fictional business path consumes it, even in development. |

### Search false positives

Input placeholder attributes/CSS are hints, not field values; they are never
submitted as business data. Fictional phone hints were removed. React Suspense
fallbacks are loading UI, not database fallthrough. The fakeinbox.com string is
a blocked disposable-email domain. Tyre dimensions in option lists, explicit
size-filter links and formatting comments do not select a customer's size.
BMW comments in the decorative 3D wheel describe artwork, not a vehicle lookup.
These are not mock business paths; the three classifications above apply to
data/success paths, not framework vocabulary.

## Result and release boundaries

PRODUCTION FAKE SUCCESS PATHS = 0

This means no identified executable application/script path supplies fictional
business records or reports a successful booking/payment/hold/admin mutation
after persistence failure. It is not a claim that commerce is launch-ready.

- Existing legacy runtime reads remain deliberately unreconciled. Missing
  legacy tables/columns/settings/RPCs produce unavailable states. Ordered
  migrations remain the proposed canonical source from the recovery audit.
- Checkout, payment/refund processing, admin mutations and online cancellation
  are unavailable until their persistent engines are implemented and verified.
  Relevant signed webhook events receive a retryable failure. Provider retry
  windows are finite; future payment recovery must reconcile outstanding events.
- A quote is read-only. A real temporary slot hold confirms only that hold, not
  a booking, inventory reservation, deposit or fitter.
- Business phone and WhatsApp remain explicit owner configuration with no
  defaults. No owner-approved values or hosted provider credentials were
  supplied or verified in this gate.
- Hosted historical seed rows, default SQL settings, existing payments and
  migration ledger require a separate read-only reconciliation. This gate did
  not read or change cloud database contents or apply legacy schema.sql.
- Email templates have no runtime callers after payment/booking mutations were
  retired; no UI claims that a confirmation email was sent. Delivery/retries
  remain part of the future verified payment/email gate.

## Local verification

Reliability unit tests: 39/39 PASS, with real TypeScript helpers and isolated
database/provider doubles. Production browser checks: 119/119 PASS across all
seven requested widths. Typecheck, lint, build, structural security and whitespace
checks PASS; lint retains 8 pre-existing warnings. See PRODUCTION_PROGRESS.md.
