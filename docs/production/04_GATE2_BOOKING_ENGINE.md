# Gate 2 - atomic booking engine

Date: 2026-10-10. Branch: gate/2-booking-engine.
Starting HEAD: 3f52936bb2a78babd7aa491f7ceea8fdfe2afa1f.
Result: **PASS - locally verified on native PostgreSQL 16.15**.
This is booking-engine acceptance, not Supabase cloud or production acceptance.

## What changed

A customer selects a time, supplies contact details, then submits one checkout.
The database reserves the fitting time and every tyre together. It returns
AWAITING_BANK_PAYMENT only after the entire transaction succeeds. Selection
and a quote make no reservation claim. No Stripe payment or bank receipt is
created. A failed or uncertain response never claims payment or booking success.

Migration 016 is the only schema extension; migrations 001-015 are unchanged.
reserve_booking_checkout(uuid,uuid,jsonb,jsonb,text,jsonb,text) is the sole
new reservation entry point. Only service_role can execute it, through the
validated Next.js checkout route. Browser roles have no EXECUTE or write grant.
The API rejects price, stock, capacity and payment-state fields, validates
the postcode, and consumes the durable request limit before reservation.

## Transaction and locks

1. Validate intent; aggregate duplicate product quantities and reject quantities
   above eight per product. Serialize the UUID checkout key with a transaction
   advisory lock. A matching retry returns the original booking; changed intent
   under that key is rejected. An expired retry never extends the deadline.
2. Materialize overdue unpaid statuses. Lock the chosen booking_slots row.
   Check active/blocked state, London arrival time, horizon and same-day rules.
   Count operational bookings plus live holds, counting a bank reservation once.
3. Lock settings and the exact active outward-postcode zone. Lock catalogue
   rows in UUID order, then inventory rows in the same order, independent of
   cart order. Recheck product activity and available stock after locking.
4. Read selling prices, fitting fee, callout fee and deposit rules from storage.
   Calculate with integer/bigint pence, round percent deposits to the nearest
   penny, and reject amounts beyond the integer storage range.
5. Create the slot hold and inventory holds; persist the supplied customer;
   create the booking and immutable SKU/brand/model/size/price item snapshots.
   Link the hold to its booking. All locks last through transaction commit.

Any SQL error rolls back the complete statement, including customer, booking
and hold inserts. A test-only trigger fails the last item-insertion step and
proves every business table remains at its prior row count.

Row locks and consistent lock ordering follow the
[PostgreSQL locking contract](https://www.postgresql.org/docs/16/explicit-locking.html).
No application mutex or browser stock check is relied on for correctness.

## Expiry and stock accounting

business_settings.bank_payment_window_minutes is nullable with a 1-10080
minute constraint. It has **no default**. Missing configuration rejects checkout
as pricing_unavailable. The owner must supply the actual business policy using
an authorized server-side settings change; this gate adds the database setting, not a
settings editor or an invented policy.

inventory.reserved_qty retains existing non-expiring operational allocations.
Temporary bank reservations are represented by inventory_holds. They are not
also added to reserved_qty. Available quantity is:

stock_qty - reserved_qty - sum(live inventory hold quantities)

live_inventory_held() and slot_consumption() use the database clock and exclude
expired holds and unpaid deadlines directly. Cleanup can remain idle without
blocking a new reservation. Expired hold rows are retained as historical
records; release means they no longer consume a resource.

expire_unpaid_bookings() materializes EXPIRED on the next checkout or manage
read and is safe for periodic maintenance. Stored status may lag the deadline
until a read/maintenance call; resource availability does not. The manage page
rechecks the server at the persisted deadline. The native test waits for an
actual one-minute database deadline without running cleanup, proves both
resources free, reserves them again, and verifies the original booking is
EXPIRED. Its retry returns that same expired booking.

Inventory updates/imports cannot reduce stock below operational plus live
temporary allocations. Slot capacity cannot shrink below live occupancy.
Booking item UPDATE/DELETE and changes to bank reservation terms are rejected.
A legacy release request cannot delete a linked bank hold or claim it released
when no legacy row was deleted.

## Verification

[Native PostgreSQL evidence](evidence/GATE2_POSTGRES.json) and
[final test output](evidence/GATE2_POSTGRES_TESTS.txt) record the migration
hashes, native server version, target attestation and results.

| Scenario | Native result |
| --- | --- |
| Capacity 1; 20 simultaneous sessions | 1 success, 19 slot_conflict (P2002) |
| Stock 2; quantity 2; 20 independent slots | 1 success, 19 out_of_stock (P2003) |
| Two-item carts in opposite orders; 20 sessions | 1 success, 19 out_of_stock; no deadlock |
| Same checkout key; 20 sessions | 20 matching responses, one persisted booking/customer/hold set |
| Real unpaid deadline; cleanup idle | Slot and stock released; EXPIRED persisted on next checkout |
| Negative / oversold inventory; overbooked slots | 0 rows |

Each race uses 20 distinct backend connections, begins real transactions,
blocks a database resource, observes all 20 sessions waiting on locks in
pg_stat_activity, then releases them. This is not PGlite queue concurrency.
Test fixtures exist only inside the disposable local database.

Final checks: 12/12 native PostgreSQL acceptance; 16/16 migration/security SQL
checks; 94/94 reliability checks; 154/154 responsive browser checks at 360,
375, 390, 430, 768, 1366 and 1440px. After the final legacy release-response
correction, the production build and all seven actual credential-free API
checks were rerun and passed. Typecheck, lint, security structure and
git diff --check passed. Lint retains four existing warnings. The 68 compiled
browser JavaScript/map assets contain zero SUPABASE_SERVICE_ROLE_KEY identifiers.

## Reproducing native tests

Download the official portable binaries from
[EDB](https://www.enterprisedb.com/download-postgresql-binaries).
The archive used here was
[PostgreSQL 16.15 Windows x64](https://get.enterprisedb.com/postgresql/postgresql-16.15-1-windows-x64-binaries.zip).
Its locally calculated SHA-256 is
25e6fcdfb8caec38691bf461125e7564508760666f7b8e5dc6a5f0818f58f81e.

Extract pgsql/bin, pgsql/lib and pgsql/share under
.local-postgres/engine/, or set GATE2_POSTGRES_BIN to your installed binary
directory. Run npm run test:concurrency. Binaries, data directories and logs
are ignored by Git and ESLint. No PostgreSQL service is installed.

The runner accepts no external database connection string. It creates a fresh
workspace cluster on 127.0.0.1 with a random port, verifies its actual
data_directory before migrations, then stops that exact cluster in finally.
Local trust authentication is confined to this disposable loopback instance.
The test Auth schema is a stand-in; it does not establish Supabase GoTrue,
cloud Auth, PostgREST or hosted session acceptance.

## Release boundary

No cloud database, owner business records, production service, Git remote or
deployment was modified. Gate 0 cloud acceptance and Gate 1 owner/provider
data acceptance remain BLOCKED. The payment window must be configured before
booking can operate. Bank account instructions, payment verification, payment
status transitions, cancellation/refunds and delivery remain separate gates.
The database rejects an unverified bank booking transition to confirmed; this
gate cannot falsely mark a bank transfer paid.
