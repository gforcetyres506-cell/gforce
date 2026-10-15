# Gate 3: manual bank transfer payments

Branch: `gate/3-bank-payments`. Baseline: `a6a9a3f43974f5374b2db5550c4b2a676c20a208`.

Status: **PASS — locally verified on native PostgreSQL and compiled UI**. No cloud database,
real bank account, hosted Auth session or actual email inbox has been verified.

## Payment policy and owner configuration

The owner explicitly selected **full booking total** in this chat. Every new
reservation has `deposit_pence = total_pence` and `balance_pence = 0`; those two
historical column names remain for compatibility. `payments.type = deposit`
is the existing initial-payment discriminator, not a partial-payment policy.
Read-only quotes and customer copy now use the full bank transfer amount.

Migration 017 is additive; migrations 001–016 are unchanged. The owner configures
`bank_account_name`, `bank_name`, `sort_code`, `account_number` and
`bank_payment_window_minutes` at `/admin/data`. No bank details or payment window
are seeded. Account and sort code are text, preserving leading zeroes. Blank or
invalid configuration blocks new reservation/payment instructions. Settings
changes require a live owner session and write an audit entry without account
numbers in its metadata.

## One reservation and payment record

`reserve_booking_checkout` retains the Gate 2 slot/inventory locking order,
authoritative integer-pence pricing, coverage checks, immutable cart snapshots
and idempotent checkout key. The same database transaction now also creates one
manual pending payment for the full total. Failure rolls back customer, booking,
items, holds and payment together. There is one manual payment per booking.

New payment rows have `provider = manual`, `payment_method = bank_transfer`,
amount/currency/reference, bank instruction snapshot, status, paid timestamp,
verifying admin profile, created/updated timestamps. Manual statuses are exactly
`pending`, `received`, `refunded`, `cancelled`. Historical Stripe statuses/receipts
remain readable; no new Stripe identifier or checkout is created. Refund and
cancellation execution remain outside this gate.

Bank instructions are captured from the owner settings inside reservation.
Later settings edits do not silently change an existing customer's destination.
The private manage link shows reference, full amount due, bank name, account
name, sort code, account number, payment reference and UK-time expiry, with copy:

> Your fitting is reserved while we wait for payment. Use your booking reference
> when making the transfer. Your booking is confirmed after G Force verifies receipt.

Pending payments never activate the paid progress step. A received manual payment
requires a recorded verifier, timestamp and matching full amount before the UI
shows payment received. No bank feed, customer assertion or timer verifies money.

## Phone bookings and staff controls

`/admin/bookings/phone` reuses the public finder, sidewall/manual-size flow,
catalogue component and booking wizard. It reaches a separately protected phone
endpoint, which invokes the same reservation transaction through
`admin_reserve_phone_booking`. The server supplies the Auth-verified actor;
browser `booking_source`, price, stock or payment-state fields are rejected.
The source is `phone`, initial status `AWAITING_BANK_PAYMENT`, and creation is
audited. Staff can open the manage link, copy instructions or request an email.
New public reservations explicitly record `online`; historical rows whose source
was not stored retain null. No historical phone/online classification is invented.

Staff verification opens the actual confirmation dialog:

> Have you confirmed £X has arrived in the G Force business bank account?

`admin_verify_bank_payment` rechecks the live admin/owner profile and session,
locks booking, payment, slot and inventory in deterministic order, then rechecks
expiry after all lock waits. The amount shown to the verifying staff member must match the
database amount. It writes receipt timestamp/verifier, moves booking to
`CONFIRMED`, deactivates temporary holds, increases operational `reserved_qty`
and writes an audit entry in one transaction. The confirmed booking consumes
its slot once; permanent stock allocation no longer expires with the bank window.
Duplicate verification returns the original receipt without a second allocation
or audit. A late audit failure rolls back the entire operation.

Anonymous/customer/viewer/inactive/revoked actors cannot call these mutations.
Browser DB roles remain read-only; privileged RPCs are service-only. Profiles
and sessions are locked through commit, and owner role changes share the same
authorization lock. Transaction guards reject incidental direct paid-state or
deadline updates. They do not replace the privileged server authorization boundary.

## Expiry and explicit extension

Gate 2 live-hold predicates release slot and inventory immediately at unpaid
expiry, without a cron. Lazy maintenance persists `EXPIRED`. Expired payments
remain unpaid; actual late transfers need explicit business reconciliation,
never automatic confirmation after resources may have been resold.

An admin/owner can request 1–10,080 additional minutes with a reason. The expected
old deadline prevents a stale retry extending twice; comparisons preserve
millisecond precision across JavaScript/PostgreSQL. Extension locks and checks
both resources again. An expired booking is reactivated only when its original
slot and every item can be reserved again. Taken slot or stock returns a conflict
with no partial changes. Old/new deadlines, minutes, actor and reason are audited.

## Email instructions

Email is staff-requested. A durable `email_outbox` claim captures the recipient
and immutable instruction payload; the same booking/deadline uses one request
key. Concurrent active sends reject, acknowledged sends do not resend, failed
or interrupted sends retry with the same provider idempotency key. The lease is
two minutes. Ambiguous requests older than 23 hours require provider
reconciliation before retry, because Resend's idempotency guarantee is 24 hours.

The server requires `RESEND_API_KEY`, an actual `EMAIL_FROM` sender and an HTTPS
`NEXT_PUBLIC_SITE_URL`. It uses plain text, a 15-second timeout and the documented
[Resend send endpoint](https://resend.com/docs/api-reference/emails/send-email)
and [idempotency contract](https://resend.com/docs/dashboard/emails/idempotency-keys).
Missing configuration, timeout, provider rejection, malformed acknowledgement or
unrecorded completion cannot report email accepted. The UI explicitly distinguishes
provider acceptance from inbox delivery. No test sends an actual external email.

## Acceptance evidence

- Native PostgreSQL 16.15: Gate 3 **17/17 PASS**; current-chain Gate 2 **12/12 PASS**.
- Twenty independent simultaneous verification requests produce one receipt,
  one permanent allocation and one audit; all 20 receive the same receipt.
- Capacity 1: 1 success / 19 conflicts. Stock 2, quantity 2: 1 success / 19
  out-of-stock. Multi-item contention and idempotent reservation retry also pass.
- Online/phone pending creation, missing bank configuration, full amount,
  receipt, duplicate/wrong-state/amount denial, viewer/anonymous denial,
  deactivation/revocation, multi-item conversion, rollback, real unpaid expiry,
  resource release/reacquisition, stale extension and audit entries pass.
- A verifier starting before expiry but waiting on an inventory lock until after
  expiry is rejected; a competing checkout then acquires the released resources.
  Upgrade testing preserves unknown historical source and creates no invented payment.
- Oversold inventory, overbooked slots and negative stock: **0**.
- SQL/security catalogue: **16/16 PASS**. Reliability routes/providers: **118/118 PASS**.
- Responsive browser: **203/203 PASS**, at 360, 375, 390, 430, 768, 1366 and 1440px.
- Typecheck, lint, production build, security structure and `git diff --check`:
  **PASS**. Lint retains four pre-existing warnings and introduces none.
- Compiled browser assets: **76** scanned; `SUPABASE_SERVICE_ROLE_KEY`
  identifier occurrences: **0**.
- Evidence: [native payment tests](evidence/GATE3_POSTGRES_TESTS.txt),
  [migration hashes and payment races](evidence/GATE3_POSTGRES.json),
  [booking regression](evidence/GATE3_BOOKING_REGRESSION.json),
  [quality results](evidence/GATE3_QUALITY.json).

Run `npm run test:concurrency`, `npm run test:bank-payments`, `npm run test:database`,
`npm run test:reliability`, `npm run test:ui`, `npm run typecheck`, `npm run lint`,
`npm run build`, `npm run test:security`, `git diff --check`.

Both native runners accept only a new runner-created loopback database, never a
cloud connection string. Minimal Auth tables in those tests prove SQL role/session
checks, not hosted GoTrue/cookie acceptance. Browser staff tests render the actual
components in an isolated harness with test router/provider doubles; they do not
bypass production Auth. Other browser tests exercise the compiled Next application.

No push, deployment, cloud reset/migration, business data import or real bank/email
transaction was performed. Gate 0 live Supabase acceptance and Gate 1 owner data /
OneAuto sandbox acceptance remain **BLOCKED**. Existing Gate 2 reservations without
a manual payment record require explicit reconciliation; migration 017 does not
invent payments or received money for historical rows.
