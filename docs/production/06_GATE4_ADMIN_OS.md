# Gate 4: owner admin operating system

Branch: `gate/4-admin-os`. Baseline: `3dd03fa` (completed Gate 3).

Status: **PASS — locally verified against native PostgreSQL and the compiled UI**.
Hosted Supabase Auth, invitation email delivery and real owner data remain unverified.

## Operating surface

The private admin navigation now exposes `/admin`, `/admin/bookings`,
`/admin/products`, `/admin/inventory`, `/admin/slots`, `/admin/zones`,
`/admin/fitters`, `/admin/customers`, `/admin/payments`, `/admin/settings`,
`/admin/audit` and `/admin/access`. Every route inherits the protected admin
layout. Public navigation still advertises none of them.

The dashboard calculates its metrics from current database rows. It reports
today's active jobs, pending bank reservations, confirmed and upcoming work,
completed/cancelled totals, received and outstanding manual-payment amounts,
available future capacity, low stock after permanent and live temporary holds,
unassigned active jobs and failed outbox messages. Database errors fail the
entire dashboard; no metric is filled with demo data.

## Operational transactions

Migration 018 adds no business rows. It introduces `special_dates`, additional
policy/VAT settings, before/after audit snapshots and service-only admin RPCs.
Browser roles retain SELECT-only database access. Every mutation follows:

`protected server route -> session/RBAC check -> privileged RPC -> row locks -> mutation + audit -> commit`

Bookings support search/filter, the shared phone-booking funnel, fitter
assignment, valid status transitions, capacity-checked rescheduling, explicit
payment-window extension and cancellation. Receipt verification continues to
use Gate 3's locked bank-payment transaction. Cancellation does not claim that
money moved. A refund can be recorded only after explicit staff confirmation
that it left the bank, and the immutable ledger stores the amount, bank
reference, time and verifying admin. Destructive controls open a confirmation
dialog.

Products can be created, edited and archived. Inventory supports cost/selling
price, stock, supplier SKU, low-stock threshold and labelled physical cycle
counts. A CSV import accepts 1–500 rows with an exact header and commits all rows
or none. Product, inventory and import operations are audited.

Weekly rules, operating hours, duration and capacity generate concrete slots for
an explicit date range. Blocked dates, special-date hours and individual slot
capacity are owner-controlled. Existing booking capacity and inventory guards
still reject unsafe reductions.

Zones, fitters and general settings are editable. Only real persisted fitters
are shown, with current non-terminal workload. Customer records expose stored
registrations plus booking and payment history. Bank details stay in the
owner-only settings flow added in Gate 3; general settings cover phone, email,
WhatsApp, fitting fee, horizon, same-day cutoff, VAT, cancellation policy, terms
and privacy policy.

Owner access can invite/provision owner, admin or viewer users and can change or
deactivate existing access. The current owner cannot demote or deactivate their
own account, and the last active owner remains protected. If profile creation
fails after an Auth invitation, the incomplete invited user is removed.

## Immutable audit

Gate 4 operations write actor, action, resource, before state, after state,
metadata and timestamp in the same transaction as the business change. Bank
name, account name, account number and sort code are excluded from audit
snapshots. A completion trigger gives new Gate 3 payment events meaningful
before/after states. Database triggers reject audit update and delete attempts.
Historical rows created before migration 018 remain valid and may have null
before/after fields.

## Owner acceptance

The native PostgreSQL acceptance script starts an empty loopback-only PostgreSQL
16 cluster, applies migrations 001–018, and uses only the protected RPC contract
for business changes. It passes this sequence:

1. Add a service zone and product, import a validated CSV product row, configure
   weekly hours, create special-date hours and generate slots.
2. Create a phone booking through the authoritative reservation transaction.
3. Verify the full bank payment and assign a real persisted fitter.
4. Change stock, selling price and low-stock threshold.
5. Block a date, reschedule the confirmed booking and change business settings.
6. Provision admin and viewer profiles for existing test Auth users and change
   the viewer's role through the protected owner transaction.
7. Cancel the booking and prove the inventory allocation is released once.
8. Reserve and verify a second booking, then record a full refund with its bank
   reference, amount, timestamp and admin actor.

It also proves viewer/browser mutation denial, owner self-lockout prevention,
immutable audit history, exact catalogue checks and zero negative inventory or
over-capacity slots. An injected audit failure proves that the associated stock
change rolls back. This is local database proof; the provision step uses a
disposable local Auth row and does not prove hosted invitation delivery.

## Acceptance boundary

No cloud database, production Auth user, real customer, bank account, email
recipient, provider account, push or deployment was changed. A real owner must
still supply products, zones, fitters, settings and bank details. Gate 0 hosted
Auth/RLS, Gate 1 owner data/OneAuto sandbox and real invitation/email delivery
remain **BLOCKED** until an authorized disposable project and provider evidence
are supplied.

Run `npm run test:admin-os`, `npm run test:concurrency`,
`npm run test:bank-payments`, `npm run test:database`,
`npm run test:reliability`, `npm run test:ui`, `npm run typecheck`,
`npm run lint`, `npm run build`, `npm run test:security` and `git diff --check`.
