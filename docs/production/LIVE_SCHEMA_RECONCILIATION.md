# Legacy Supabase reconciliation — review draft

Prepared for `gforcetyres506-cell/gforce`, branch `release/seo-security-launch`, on 2026-10-13. **Nothing in this change has been applied to hosted Supabase. No production credentials, customer values or hosted exports were used.** The SQL is a human-review candidate, not execution approval.

## Evidence and limits

The inspected legacy source is `supabase/schema.sql` at main commit `61346440dd64e5dacff31d6e6409236d08d3e6c8`. Release source is migrations 001–018 at `1319f10f0fc26c0c1a859490fd544f779b279f89`. Both remote branch heads were checked during this work. The supplied live counts are an operator report, not a new live inspection: 5 Auth users; 1 admin; 33 tyres; 13 zones; 106 slots; 3 bookings; 3 items; 4 holds; 1 settings row; 2 audits; 1 rate-limit row; zero reported interests/VRM entries. Unlisted tables and all persisted rows remain important.

The actual hosted catalogue, extensions, publications, grants, Auth hooks, scheduled jobs and values have **not** been verified. A local PASS below proves the supported legacy shape and synthetic-data mapping only. Live application, GoTrue login, provider delivery, production backup/restore and deployment remain untested.

## Files and transaction

* `supabase/production/019_live_legacy_reconciliation.sql`: self-contained transaction, backup, explicit mapping, canonical DDL and assertions. Intentionally outside `supabase/migrations`; an ordinary migration push must never auto-apply it.
* `supabase/verification/019_live_reconciliation_verify.sql`: read-only canonical/security and preservation assertions, returning table names, counts and PASS only. Run immediately after reconciliation, before any writes resume. Baseline counts/hashes deliberately stop matching after legitimate new users or bookings; this is not a perpetual production health check.

The path copies every ordinary, non-extension-owned public business table to `legacy_backup_20261013`, checks complete logical row fingerprints, then moves each original into `legacy_source_20261013` without changing its OID. The originals retain PKs, FKs, indexes, defaults, triggers, sequences and data. Copies use `LIKE INCLUDING ALL`; PostgreSQL does not copy FKs or triggers with LIKE, so those remain on the separately retained originals. Generated and identity columns are handled explicitly when copying. Extra business tables are copied and archived too; their data is preserved, but they are not silently exposed through the new API or interpreted as a new canonical feature.

Both archive schemas deny usage and all table/sequence privileges to PUBLIC, anon, authenticated and service_role. Backup tables have RLS with no runtime policies. Old RPCs move into the private source schema and lose runtime execution privileges. No Auth table is copied: only counts and whole-table fingerprints are stored. Auth identities and sessions are never inserted, updated or deleted by reconciliation.

The transaction takes one advisory lock, freezes Auth writes with SHARE locks, and takes ACCESS EXCLUSIVE locks on all source business tables before copying. The lock timeout is 5 seconds and each statement timeout is 180 seconds. Any exception aborts the transaction; the operator must issue ROLLBACK on a pinned connection, or close it. No application write may continue during this maintenance operation. Copying/indexing requires space for both the original and backup plus the new canonical data; measure space and rehearse duration on an authorized clone first. A same-database archive is not independent disaster recovery: obtain and test an external backup/PITR restore separately before any future live approval.

Preflight fails on a previous archive, mixed canonical/legacy tables, missing or extra columns/types on mapped tables, absent active owner, public views/materialized views/partitions/foreign tables/custom enums/domains/ranges, publication membership, external incoming FKs, and external triggers using public functions. The expected shape is frozen in SQL. An unsupported live variant requires a reviewed amendment and another rehearsal; never suppress an exception or delete conflicting data to make it pass.

After archival, the file builds the exact canonical contract from the frozen 001–018 definitions, then restores data through the mappings below. This is **not** a blind replay onto incompatible legacy tables: all source records and constraints have already been retained, and no old business table remains under a canonical name. Source SHA256 hashes identify each frozen DDL block. The sole canonical DDL correction scopes migration 010's FK-existence test to `public.bookings`; its old database-wide constraint-name test would otherwise mistake the preserved legacy FK for the new FK. Original migrations 001–018 are unchanged. No business seed data or migration-ledger rows are installed.

## Explicit mapping

Money remains integer pence. There is no currency conversion, catalogue repricing, payment verification or refund fabrication.

| Legacy source | Canonical destination | Preservation and deliberate defaults |
|---|---|---|
| `admin_profiles` | `admin_profiles` | All IDs, user IDs, names, roles, active flags and timestamps unchanged. Existing owner remains active; no account is elevated. Final role check additionally permits viewer. |
| `customers.id/email/created_at` | same ID/email/created_at | `name` is kept whole in `first_name`, `last_name=''`; absent name/phone becomes an empty unknown value, not a fabricated contact. `updated_at=created_at` because no source update timestamp exists. Addresses/city/postcode remain verbatim in both private originals and copies. |
| `fitters` | `fitters` | IDs, name, phone, active and creation time unchanged; `van_name=NULL`, `updated_at=created_at`. |
| `tyre_inventory.id` | `tyre_products.id`, `inventory.id/tyre_product_id` | Both IDs reuse the old UUID. One product and one inventory row per tyre. |
| tyre SKU/brand/model/dimensions/load/speed | same product attributes | SKU is not trimmed or case-folded. Slug is exactly `sku-` + lowercase UTF-8 hex of SKU, as in owner_import_business_data and admin_os_mutate. |
| `is_run_flat/is_xl/season/tier` | `run_flat/extra_load/season/tier` | Booleans/season retained; only `mid -> standard`. Budget/premium unchanged. |
| `wet_grip/fuel_economy/noise_db/active` | `wet_grip_rating/fuel_efficiency_rating/noise_db/active` | Exact preservation. `image_url=NULL`; no source image exists. Product update time uses creation time. |
| `stock/cost_price/sell_price` | `stock_qty/cost_price_pence/selling_price_pence` | Exact stock/cost/price. `reserved_qty=0`; see operational safeguards below. `supplier_sku=NULL`, canonical low-stock threshold 2 is an operational default, not evidence of owner approval. Inventory update time uses source creation time. |
| `service_zones.zone_name/callout_charge` | `name/callout_fee_pence` | IDs, postcode prefix, charge, active and creation time unchanged. Every zone gets canonical neutral priority 100, since no legacy priority exists. No postcode normalization or invented coverage. |
| `booking_slots.slot_date/start_time/end_time/max_bookings` | `date/start_at/end_at/capacity` | IDs, dates/times, capacity, active and creation time unchanged. New end-after-start and date/start/end uniqueness constraints must pass. Pending legacy bookings close their slot to new checkout using `blocked_reason`; capacity is never inflated. |
| `bookings.booking_ref/vehicle_reg/fitting_postcode` | `reference/registration/postcode` | IDs, manage tokens, customer/slot/fitter references, make/model/derivative, notes, timestamps and status unchanged. Missing legacy fitting address/postcode becomes an empty unknown string because canonical fields are non-null. Original NULL values remain in both archives. |
| `tyres_total/fitting_fee/callout_charge/total_amount/deposit_amount/balance_due` | `subtotal_pence/fitting_fee_pence/callout_fee_pence/total_pence/deposit_pence/balance_pence` | Preserve every historic integer independently, even if old totals disagree; never recompute history. Negative values abort. New bank checkout terms are NULL, so the new bank-total equation is not falsely applied to old orders. |
| Legacy Stripe intent/charge/deposit timestamp | private booking originals/copies | Retained as historical source only. No canonical payment/receipt is created from these fields. `booking_source`, `service_zone_id`, checkout key/fingerprint and bank deadline stay NULL because the old schema has no reliable source. |
| `booking_items.tyre_id` | `tyre_product_id` | Same old tyre UUID, same item/booking UUID. Existing NULL tyre references remain NULL; non-null orphan references abort. |
| Item quantity/unit_price/line_total | quantity/unit_price_pence/line_total_pence | Exact historical numbers. Never read today's selling price to reconstruct them. |
| `booking_items.tyre_label` | `model_snapshot` | Entire historic label kept verbatim. `brand_snapshot/size_snapshot=''`: structured historical values were never recorded. `sku_snapshot` uses the linked legacy SKU as an identifier, or blank if the old FK is NULL; it is not represented as a proven historical SKU snapshot. |
| `slot_holds.session_token` | `token` | IDs/slot IDs/deadlines/creation times unchanged. A unique source token stays unchanged. For a duplicated token, each conflicting hold receives `legacy-hold:<hold UUID>`, without collapsing rows. An unlikely collision with an existing literal token aborts. `booking_id=NULL`; no unproven relationship or new expiry is invented. |
| `app_settings` | `business_settings` singleton | Deposit mode and its applicable fixed/percent value, fitting fee, duration, phone and cancellation text copied as unapproved historical settings. `pricing_configured=false` unconditionally. The inactive deposit alternative is retained in both archives. |
| No approved bank source | business bank fields/window | All NULL. No invented bank information, payment window, phone/email or legal text. Existing canonical operational defaults (hold 15 minutes, horizon 60 days, same-day off, VAT false, cancellation notice 48 hours) remain provisional defaults; owner review is required. The settings update trigger stamps the cutover update time. |
| `audit_log` | `audit_logs` | Same audit UUID/action/entity ID/creation time. Exact UUID actor matches only an existing Auth user; all other actors map to NULL. Original actor, entity and full metadata are nested under distinct legacy metadata keys. A missing entity maps to internal resource label `legacy_unspecified`. `after_state={legacy_import:true}` prevents the release audit-completion trigger from falsely manufacturing a bank receipt if a legacy action has the same name. |
| `rate_limits` | `rate_limits` | Bucket windows consolidate by bucket; hits sum, newest window is retained, expiry is newest window + the legacy cleanup's one hour. Deterministic newest-window/UUID tie-break chooses the canonical ID. Integer overflow/negative hits abort. All original rows and windows remain archived. This is a conservative throttle, not a claim of current user activity. |
| `interest_registrations` | same table | Every field and UUID unchanged, including any rows omitted from the reported live count. |
| Plaintext `vrm_cache` | private archives; canonical cache starts empty | Never label JSON plaintext as encrypted bytes. No encryption key is read or generated. The release will refill its encrypted cache through its normal lookup path when that provider is enabled. |
| No old equivalents | availability_rules, blocked_dates, special_dates, inventory_holds, payments, webhook_events, email_outbox | Created empty with the release constraints, indexes, RLS, RPCs and guards. No invented slot-generation rules, receipt, refund, reservation or email is seeded. |
| Any additional ordinary business table | both private archives | Exact full logical rows and original object/FK structure preserved. Human review must decide whether the new application needs an additional explicit mapping before cutover. |

## Legacy operational safeguards

The old `confirm_booking_paid` function subtracts sold quantities from `tyre_inventory.stock`; the final bank workflow instead keeps on-hand stock and an explicit non-expiring allocation counter. There is no source reserved counter and old slot holds contain no product quantities. Therefore deriving positive new reservations from historical bookings could reserve already-subtracted units twice. This path preserves exact stock and sets the new counter to zero. No product holds are invented.

All migrated bookings are readable but immutable through the additional `bookings_legacy_preservation` trigger, including attempts by the server role. Admin cancellation/refund/status/reschedule operations involving these bookings fail atomically before they can persist an allocation change. The normal Gate 1–4 functions remain unchanged for **new** bookings. Do not remove this guard to make an old order editable. First reconcile outstanding physical stock, provider/payment records, remaining appointments and any duplicated holds with the owner, then prepare a separate reviewed operational migration. This deliberate restriction means this draft does not certify uninterrupted management of historical orders.

All nine old states (`pending_payment`, `confirmed`, `tyres_reserved`, `fitter_assigned`, `en_route`, `completed`, `cancelled`, `refunded`, `payment_failed`) are already accepted by the final constraint and remain exactly unchanged. In particular lowercase legacy `confirmed` is not rewritten to the new bank workflow's uppercase `CONFIRMED`. Unknown live states fail the transaction rather than receive a misleading paid or cancelled status. Legacy pending bookings have no approved payment deadline: their slots are blocked from new checkout, and the original holds remain intact. Incompatible/end-before-start slots, conflicting unique keys and over-capacity live holds also stop for review instead of silently discarding data.

The new application will not use the old main schema after this change. Maintenance and a separately approved application cutover are required; this commit does not authorize that deployment. Pricing stays unavailable until the owner configures and approves the current business data and bank details. Source archives preserve history but are not a database downgrade plan; after a committed cutover, do not move tables back over new writes. Use a separately reviewed restore/forward repair strategy.

## Assertions and security target

Before commit, the file checks every source archive OID, copied/original count and complete logical-row fingerprint; Auth users and sessions count/content; all mapped IDs/counts; owner role/active/user relationships; all tyre attributes/SKUs/stock/prices/slugs; booking tokens/statuses/fields/amounts; historical item labels/prices; service zones and slot shape; orphans; stock/hold and slot-capacity invariants; empty payment/outbox; and unconfigured pricing/bank fields. It asserts archive isolation and the legacy booking guard.

The same transaction also contains the assertion block from the release catalogue verifier: 22 canonical RLS tables, 22 single-ID PKs, 20 unique constraints, 66 CHECK constraints, 18 FKs, 25 named indexes and 25 policies, exact column-level public grants, browser write denial, session-bound admin reads and service-role-only privileged RPCs. There are 67 total canonical indexes (including constraint indexes). The extra legacy guard lives alongside the 17 canonical triggers. Legacy API policies/functions are isolated, not carried into the public API.

Active owner/admin/viewer reads require a live `auth.sessions` row. Privileged mutation RPCs recheck the supplied actor/session, role and locks in the mutation transaction. Public catalogue reads expose only allowed product/zone columns. Anonymous users cannot read inventory/cost/customer/payment data; authenticated users cannot mutate tables or execute server RPCs. Owner provisioning/access changes, atomic checkout, hold expiry, bank verification/extensions, phone checkout, email claims/completion, Admin OS, inventory and full-refund recording use the exact frozen release behavior. No service role key or credential is put into SQL or documentation.

## Future human execution — not authorized by this change

1. Obtain a separately authorized, read-only live catalogue review. Compare main's baseline with actual tables, columns, checks, FKs, indexes, triggers, function definitions/ACLs, role inheritance, RLS, publications, storage dependencies and scheduled jobs. In particular inspect non-public views/functions and dynamic SQL/cron/hooks: PostgreSQL cannot discover every dependency hidden in text. Resolve extra tables and outstanding legacy orders. Establish the application's Supabase identity and exact database target separately. Do not use the disposable reset runner.
2. Rehearse the reviewed target shape on a clone using synthetic/redacted data. Obtain an independent backup and demonstrate restoration; calculate storage/time/lock budget. Stop application, webhook, cron, worker and admin writes, including Auth changes, for the approved window. No automatic ledger repair or environment change is part of this operation.
3. Review the entire draft, including the preservation assertions. **Do not run the draft as-is in the Supabase SQL Editor and attempt to COMMIT in another editor action.** A pooled editor connection cannot be assumed to preserve that transaction between actions. Use the complete reviewed atomic companion described below, with BEGIN, all mapping/assertions and final COMMIT in the same execution. A future dry run must use a pinned connection or a complete single-execution copy ending ROLLBACK, and must also occur only after explicit live approval.
4. Only after separate execution approval, run the reviewed atomic companion once as the database migration owner. On error, stop and confirm rollback; never run the next SQL fragment after an error. Do not retry a partially understood error. If the client disconnects, establish whether commit happened before any retry. Existing archive schemas intentionally block reruns.
5. Run `019_live_reconciliation_verify.sql` immediately while writes remain stopped; it begins READ ONLY and rolls back. Review names/counts only. Check provider/history/stock and the actual release app separately before owner configuration, deployment, reopening writes or any real payment/email test. Keep legacy order safeguards until a separately reviewed operational resolution exists.

### Atomic SQL Editor companion

An ignored review-only companion is generated locally at `.vercel/019_live_legacy_reconciliation_atomic_review.sql`. It contains the **entire** reviewed reconciliation plus one final `COMMIT;`, in one execution; it is not a standalone COMMIT fragment. It has not been sent to any hosted connection. Only the three requested tracked files are committed. A reviewer can reproduce the companion from the committed draft without reading environment files:

```powershell
@'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('supabase/production/019_live_legacy_reconciliation.sql','utf8');
assert(source.startsWith('BEGIN;'));
assert(source.endsWith('-- REVIEW REQUIRED BEFORE COMMIT\n-- COMMIT;\n'));
mkdirSync('.vercel',{recursive:true});
writeFileSync('.vercel/019_live_legacy_reconciliation_atomic_review.sql',
  '-- REVIEW COPY ONLY: LIVE EXECUTION REQUIRES SEPARATE APPROVAL\n'+source+'\nCOMMIT;\n');
console.log('Review copy created locally; no SQL executed.');
'@ | node --input-type=module
```

Diff the complete companion against the reviewed draft; the warning and single terminal COMMIT are the only additions. Review/approval must refer to the full file and exact target. The committed draft still ends exactly `-- REVIEW REQUIRED BEFORE COMMIT` and `-- COMMIT;` and never commits automatically.

## Migration ledger after successful verification

Do not create or populate `supabase_migrations.schema_migrations` during reconciliation. Missing history is not evidence that historical migrations ran. The 019 file is a deliberately separate legacy cutover, not a migration-queue item.

After the target schema, preservation checks and real application acceptance pass, plan a separately approved baseline/ledger repair. Snapshot actual schema and ledger first. Use the Supabase CLI version and its documented repair workflow supported at that time, rehearsed on a clone. Record 001–018 as a schema-equivalent imported baseline only if the complete catalogue matches those definitions; explicitly record the legacy reconciliation and additional guard in the baseline record. Never run db push against missing history before this review: it would try to apply the old chain over an already-populated target. Do not mark an unexecuted migration as applied merely to suppress an error. No migration repair was run here.

## Local acceptance and reproduction

Validated on native PostgreSQL 16.15 using synthetic data only. Full run: 2026-10-13 00:10:08–00:13:23 UTC. **48/48 workflow/security tests passed, zero skipped; 10/10 failure/rollback cases passed.** The final verification report's canonical table-count filter was then rechecked with the 16-test security suite and all 10 rollback cases; no workflow SQL changed.

| Acceptance | Local result |
|---|---|
| Source backup, unknown-table preservation, Auth IDs/content/sessions, owner, bookings/items/tokens/historic money, catalogue/stock and zones/slots | PASS before each suite |
| Canonical schema/constraints/indexes/triggers/RLS/grants and RBAC/session denial | PASS; security 16/16 |
| Gate 2 atomic booking | PASS 12/12; four races each observed 20 independent connections waiting simultaneously |
| Gate 3 manual bank workflow | PASS 17/17; 20 simultaneous verification retries created exactly one receipt audit/allocation |
| Gate 4 Admin OS | PASS 3/3; all 16 acceptance operations, including real test-only bank verification and explicit test-only full-refund recording |
| Negative historical price, column drift, excess slot consumption, mixed schema, view dependency, inactive owner, Auth alteration, damaged backup, disabled RLS, exposed mutation RPC | PASS 10/10: transaction rejected, archive absent after rollback, 33 old tyres and 5 Auth users retained |
| Direct mutation/deletion of a migrated booking and runtime access to archives/old refund RPC | Rejected as expected after every reconciliation |

The fixture's reported baseline counts match the operator report; additional synthetic customers/fitter/extra-table data also survive. Payments and email outbox are empty immediately after reconciliation. Synthetic payment/refund records are created only by the subsequent workflow tests with explicit fixture actors, never by mapping old Stripe data. Local output is not proof that any hosted migration or payment occurred.

The harness creates its own fresh, trust-authenticated PostgreSQL cluster listening only on 127.0.0.1, attests its exact data directory, and stops the server in finally. It ignores external database URLs and never loads `.env` files. It uses the existing ignored `.local-postgres/engine/pgsql/bin` binaries. Auth is a local SQL stand-in; no hosted Auth, storage or provider acceptance is claimed. Fixture values use synthetic names and example.invalid email addresses.

The current test suites were run against reconciliation, replacing only their fresh-001–018 setup. Expected baseline counts are increased for preserved data, and one previously unfiltered stock assertion is scoped to its own test product. No workflow assertion is relaxed. Security tests use native pg instead of PGlite; Gate 2–4 retain independent PostgreSQL connections and their race/expiry checks. Gate 3's pre-017 synthetic canonical record is inserted after reconciliation solely to retain that suite's separate historical-source assertion. This does not replace testing the three old-schema bookings, which are mapped and asserted first.

The fixture also includes three customers (one missing name/phone), one fitter, an extra unlisted business table with two generated/identity/FK rows, duplicate hold tokens, a Unicode SKU, an inactive tyre/zone/slot, one NULL historical tyre FK, historical prices different from current catalogue prices, and an old audit action named like a new receipt. These cases must preserve data without manufacturing a bank receipt or parsed snapshot. Immediate preservation verification runs before each workflow suite changes data.

### Reproduce the local test harness

The harness and fixture are embedded here to keep the commit limited to the three requested deliverables. Copy the three named fenced files below into the ignored .vercel directory, then run the commands. No installed Vercel CLI, Supabase login, secrets or environment file is needed.

```powershell
@'
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
mkdirSync('.vercel',{recursive:true});
writeFileSync('.vercel/legacy-main-schema.sql',execFileSync('git',['show','61346440dd64e5dacff31d6e6409236d08d3e6c8:supabase/schema.sql']));
'@ | node --input-type=module
node .vercel/reconcile-local.mjs
```

Use the official PostgreSQL binaries described in docs/production/04_GATE2_BOOKING_ENGINE.md. The runner refuses a missing local binary and attests its own loopback cluster directory. It retains ignored evidence and logs in .local-postgres. It creates no reusable production connection string.

**.vercel/reconciliation-fixture.sql**

```sql
-- SYNTHETIC ONLY. These values never come from a hosted project.
ALTER TABLE auth.users ADD COLUMN email text,ADD COLUMN fixture_metadata jsonb DEFAULT '{"synthetic":true}';
INSERT INTO auth.users(id,email) SELECT md5('user-'||n)::uuid,'synthetic-'||n||'@example.invalid' FROM generate_series(1,5) n;
INSERT INTO auth.sessions(id,user_id) SELECT md5('session-'||n)::uuid,md5('user-'||n)::uuid FROM generate_series(1,5) n;
INSERT INTO public.admin_profiles(id,user_id,name,role,active) VALUES(md5('admin-1')::uuid,md5('user-1')::uuid,'Synthetic Owner','owner',true);
INSERT INTO public.customers(id,name,email,phone,address_line1,postcode)
SELECT md5('customer-'||n)::uuid,CASE WHEN n=3 THEN NULL ELSE 'Synthetic Customer '||n END,
  'fixture-'||n||'@example.invalid',CASE WHEN n=3 THEN NULL ELSE '+441632960001' END,'Synthetic only','AA1 1AA' FROM generate_series(1,3) n;
INSERT INTO public.fitters(id,name,phone) VALUES(md5('fitter-1')::uuid,'Synthetic Fitter','+441632960002');
INSERT INTO public.tyre_inventory(id,brand,model,sku,width,profile,rim,load_index,speed_rating,is_run_flat,is_xl,season,tier,
  cost_price,sell_price,stock,wet_grip,fuel_economy,noise_db,active)
SELECT md5('tyre-'||n)::uuid,'Synthetic brand','Synthetic model '||n,CASE WHEN n=1 THEN 'SYNTH-Å-1' ELSE 'SYNTH-'||n END,
  205,55,16,'91','V',n%2=0,n%3=0,'summer',CASE WHEN n%3=0 THEN 'premium' ELSE 'mid' END,
  5000+n,10000+n,10+n,'A','B',70,n<>33 FROM generate_series(1,33) n;
INSERT INTO public.service_zones(id,postcode_prefix,zone_name,callout_charge,active)
SELECT md5('zone-'||n)::uuid,'AA'||n,'Synthetic zone '||n,100*n,n<>13 FROM generate_series(1,13) n;
INSERT INTO public.booking_slots(id,slot_date,start_time,end_time,max_bookings,active)
SELECT md5('slot-'||n)::uuid,date '2025-01-01'+n,time '09:00',time '10:00',2,n<>106 FROM generate_series(1,106) n;
INSERT INTO public.bookings(id,booking_ref,manage_token,customer_id,slot_id,fitter_id,vehicle_reg,vehicle_make,vehicle_model,
  fitting_address,fitting_postcode,status,tyres_total,fitting_fee,callout_charge,total_amount,deposit_amount,balance_due,
  stripe_payment_intent_id,stripe_charge_id,deposit_paid_at,customer_notes,admin_notes)
SELECT md5('booking-'||n)::uuid,'GF-SYNTH-'||n,md5('manage-'||n)::uuid,md5('customer-'||n)::uuid,md5('slot-'||n)::uuid,
  CASE WHEN n=2 THEN md5('fitter-1')::uuid ELSE NULL END,'SYNTH'||n,'Synthetic','Fixture',
  CASE WHEN n=3 THEN NULL ELSE 'Synthetic address' END,CASE WHEN n=3 THEN NULL ELSE 'AA1 1AA' END,
  CASE n WHEN 1 THEN 'pending_payment' WHEN 2 THEN 'confirmed' ELSE 'completed' END,
  8100+n,900,100,9100+n,5000,4100+n,CASE WHEN n=1 THEN NULL ELSE 'SYNTHETIC-PI-'||n END,
  CASE WHEN n=1 THEN NULL ELSE 'SYNTHETIC-CH-'||n END,CASE WHEN n=1 THEN NULL ELSE timestamptz '2025-01-01 00:00:00Z' END,
  'Synthetic customer notes','Synthetic admin notes' FROM generate_series(1,3) n;
INSERT INTO public.booking_items(id,booking_id,tyre_id,tyre_label,quantity,unit_price,line_total)
SELECT md5('item-'||n)::uuid,md5('booking-'||n)::uuid,CASE WHEN n=3 THEN NULL ELSE md5('tyre-'||n)::uuid END,
  'Verbatim historic synthetic label '||n,1,8100+n,8100+n FROM generate_series(1,3) n;
INSERT INTO public.slot_holds(id,slot_id,session_token,expires_at)
SELECT md5('hold-'||n)::uuid,md5('slot-'||(n+3))::uuid,CASE WHEN n<=2 THEN 'DUPLICATE-SYNTHETIC-TOKEN' ELSE 'SYNTHETIC-TOKEN-'||n END,
  now()+interval '15 minutes' FROM generate_series(1,4) n;
UPDATE public.app_settings SET business_phone='+441632960003';
INSERT INTO public.audit_log(id,actor,action,entity,entity_id,metadata)
VALUES(md5('audit-1')::uuid,'synthetic-actor@example.invalid','legacy_test_event','bookings',md5('booking-1')::uuid,'{"fixture":true}'),
  (md5('audit-2')::uuid,md5('user-1')::uuid::text,'payment.bank_received','bookings',md5('booking-2')::uuid,'{"fixture":true}');
INSERT INTO public.rate_limits(id,bucket_key,window_start,hits) VALUES(md5('rate-1')::uuid,'synthetic-rate',now(),1);
-- Additional unlisted business data must survive with IDs, generated columns,
-- identity sequences, extra FKs and indexes intact in the original archive.
CREATE TABLE public.synthetic_extra_business(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id uuid REFERENCES public.bookings(id),value integer NOT NULL,doubled integer GENERATED ALWAYS AS(value*2) STORED);
INSERT INTO public.synthetic_extra_business(booking_id,value) VALUES(md5('booking-1')::uuid,7),(md5('booking-2')::uuid,9);
```

**.vercel/reconcile-helper.mjs**

```javascript
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export async function reconcileDb(db) {
  await db.query(readFileSync('.vercel/legacy-main-schema.sql','utf8'));
  await db.query(readFileSync('.vercel/reconciliation-fixture.sql','utf8'));
  await db.query(readFileSync('supabase/production/019_live_legacy_reconciliation.sql','utf8')+'\nCOMMIT;');
  const result=await db.query(readFileSync('supabase/verification/019_live_reconciliation_verify.sql','utf8'));
  assert((Array.isArray(result)?result:[result]).flatMap(r=>r.rows??[]).filter(r=>r.result).every(r=>r.result==='PASS'));
  await assert.rejects(db.query("update public.bookings set admin_notes='must reject' where id=md5('booking-1')::uuid"),{code:'55000'});
  await assert.rejects(db.query("delete from public.bookings where id=md5('booking-2')::uuid"),{code:'55000'});
  await db.query('set role service_role');
  try {
    await assert.rejects(db.query('select * from legacy_backup_20261013.bookings'),{code:'42501'});
    await assert.rejects(db.query("select legacy_source_20261013.refund_booking('SYNTHETIC-PI-2')"),{code:'42501'});
  } finally { await db.query('reset role'); }
  console.log('Synthetic legacy reconciliation and immediate preservation verification PASS');
}
```

**.vercel/reconcile-local.mjs**

```javascript
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const root=resolve('.local-postgres'),bin=join(root,'engine/pgsql/bin'),data=join(root,'reconciliation-'+randomUUID());
assert(existsSync(join(bin,'initdb.exe')));mkdirSync(data,{recursive:true});
const port=await new Promise((done,fail)=>{const s=createServer();s.once('error',fail);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>done(p));});});
const exe=n=>join(bin,n+'.exe');
function run(name,args,options={}){const r=spawnSync(exe(name),args,{encoding:'utf8',windowsHide:true,...options});assert.equal(r.status,0,(r.stderr??'')+(r.error?.message??''));return r;}
run('initdb',['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
run('pg_ctl',['-D',data,'-l',join(data,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -c max_connections=60`,'-w','start'],{stdio:'ignore'});
const evidence={scope:'LOCAL_NATIVE_POSTGRESQL_SYNTHETIC_ONLY',started_at:new Date().toISOString(),suites:{},negative_cases:[]};
const url=name=>`postgresql://postgres@127.0.0.1:${port}/${name}`;
let admin;
const auth=`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;`;
const authSchema=`create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`;
const legacy=readFileSync('.vercel/legacy-main-schema.sql','utf8'),fixture=readFileSync('.vercel/reconciliation-fixture.sql','utf8');
const sql=readFileSync('supabase/production/019_live_legacy_reconciliation.sql','utf8');
function replaceOnce(source,from,to){assert(source.includes(from),'Adapter source changed: '+from.slice(0,80));return source.replace(from,to);}
try{
  admin=new pg.Client({connectionString:url('postgres')});await admin.connect();
  assert.equal(resolve((await admin.query("select current_setting('data_directory') d")).rows[0].d),data);
  await admin.query(auth);
  // Schema-only difference report: no real data or hosted connections.
  for(const [name,source] of [['legacy_baseline',legacy],['canonical_baseline',readdirSync('supabase/migrations').sort().map(f=>readFileSync('supabase/migrations/'+f,'utf8')).join('\n')]]){
    await admin.query('create database '+name);const c=new pg.Client({connectionString:url(name)});await c.connect();
    await c.query(authSchema);await c.query(source);
    const details={};for(const [key,q] of Object.entries({
      columns:"select c.relname,a.attname,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) default_value from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum",
      constraints:"select c.relname,k.conname,k.contype,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,k.conname",
      indexes:"select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname",
      policies:"select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname",
      triggers:"select c.relname,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname",
      functions:"select p.oid::regprocedure::text signature,p.prosecdef,p.proconfig,p.proacl::text,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by 1",
      grants:"select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role','PUBLIC') order by table_name,grantee,privilege_type"
    }))details[key]=(await c.query(q)).rows;
    writeFileSync('.vercel/'+name+'-catalog.json',JSON.stringify(details,null,2)+'\n');await c.end();
  }
  const negatives=[
    ['negative historical price',"update public.booking_items set unit_price=-1 where id=md5('item-1')::uuid",sql],
    ['column drift',"alter table public.bookings add column unreviewed text",sql],
    ['oversubscribed live slot',"update public.slot_holds set slot_id=md5('slot-2')::uuid",sql],
    ['mixed canonical schema',"create table public.tyre_products(id uuid)",sql],
    ['view dependency',"create view public.unreviewed_view as select id from public.bookings",sql],
    ['no active owner',"update public.admin_profiles set active=false",sql],
    ['auth changed during migration','',sql.replace('DO $preservation$',"DELETE FROM auth.sessions WHERE id=md5('session-5')::uuid;\nDO $preservation$")],
    ['backup changed during migration','',sql.replace('DO $preservation$',"DELETE FROM legacy_backup_20261013.tyre_inventory WHERE id=md5('tyre-1')::uuid;\nDO $preservation$")],
    ['canonical RLS weakened','',sql.replace('do $verify$',"ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;\ndo $verify$")],
    ['browser privileged RPC grant','',sql.replace('do $verify$',"GRANT EXECUTE ON FUNCTION public.admin_os_mutate(uuid,uuid,text,jsonb) TO anon;\ndo $verify$")],
  ];
  for(let i=0;i<negatives.length;i++){
    const [name,change,attempt]=negatives[i],dbName='negative_'+i;await admin.query('create database '+dbName);
    const c=new pg.Client({connectionString:url(dbName)});await c.connect();await c.query(authSchema);await c.query(legacy);await c.query(fixture);if(change)await c.query(change);
    await assert.rejects(c.query(attempt+'\nCOMMIT;'));await c.query('ROLLBACK');
    assert.equal((await c.query("select to_regnamespace('legacy_backup_20261013') is null ok")).rows[0].ok,true);
    assert.equal((await c.query('select count(*)::int n from public.tyre_inventory')).rows[0].n,33);
    assert.equal((await c.query('select count(*)::int n from auth.users')).rows[0].n,5);
    await c.end();evidence.negative_cases.push({name,result:'PASS: rejected and fully rolled back'});console.log('Rollback case PASS: '+name);
  }
  const suites=process.argv.slice(2).length?process.argv.slice(2):['security','gate2','gate3','gate4'];
  for(const suite of suites){
    const dbName='suite_'+suite;await admin.query('create database '+dbName);
    let source=readFileSync(suite==='security'?'tests/database/gate0.test.mjs':'tests/concurrency/'+suite+'.test.mjs','utf8');
    source="import { reconcileDb } from '../../.vercel/reconcile-helper.mjs';\n"+source;
    // Roles belong to the cluster and already exist. Auth schema is per database.
    source=source.replace(/create role anon nologin;\s*create role authenticated nologin;\s*create role service_role nologin bypassrls;/g,'');
    if(suite==='security'){
      source=replaceOnce(source,"import { PGlite } from '@electric-sql/pglite';","import pg from 'pg';");
      source=replaceOnce(source,"import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';",'');
      source=replaceOnce(source,'const db = new PGlite({ extensions: { pgcrypto } });',`const client=new pg.Client({connectionString:process.env.GATE2_TEST_DATABASE_URL});await client.connect();
const db={query:(...args)=>client.query(...args),exec:async(sql)=>{const r=await client.query(sql);return Array.isArray(r)?r:[r];},close:()=>client.end()};`);
      source=replaceOnce(source,"for (const file of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'));",'await reconcileDb(db);');
      source=source.replace("assert.equal((await db.query('select count(*)::integer as n from public.tyre_products')).rows[0].n, 0);","assert.equal((await db.query('select count(*)::integer as n from public.tyre_products')).rows[0].n, 33);");
      source=source.replace("assert.equal((await db.query('select count(*)::integer as n from public.service_zones')).rows[0].n, 0);","assert.equal((await db.query('select count(*)::integer as n from public.service_zones')).rows[0].n, 13);");
      source=source.replace("['viewer', 'admin', 'owner'].includes(role) ? 1 : 0","['viewer', 'admin', 'owner'].includes(role) ? 4 : 0");
      source=replaceOnce(source,"db.query('select stock_qty from public.inventory')","db.query('select stock_qty from public.inventory where tyre_product_id=$1',[product])");
    }else if(suite==='gate2'){
      const start=source.indexOf("  for (const file of readdirSync('supabase/migrations').sort()) {");
      const end=source.indexOf('\n  await db.query("update public.business_settings',start);assert(start>0&&end>start);
      source=source.slice(0,start)+"  await reconcileDb(db);\n  evidence.migrations=readdirSync('supabase/migrations').sort().map(file=>({file,sha256:createHash('sha256').update(readFileSync('supabase/migrations/'+file)).digest('hex')}));"+source.slice(end);
    }else if(suite==='gate3'){
      const start=source.indexOf(" for(const file of readdirSync('supabase/migrations').sort()){");
      const end=source.indexOf('\n for(const[role,a]',start);assert(start>0&&end>start);
      source=source.slice(0,start)+` await reconcileDb(db);
 evidence.migrations=readdirSync('supabase/migrations').sort().map(file=>({file}));
 legacyId=(await db.query("insert into public.bookings(reference,fitting_address,postcode,subtotal_pence,fitting_fee_pence,callout_fee_pence,total_pence,deposit_pence,balance_pence) values('GF-LEGACY-TEST-ONLY','Test fixture','E14 8PX',0,0,0,0,0,0) returning id")).rows[0].id;`+source.slice(end);
      source=replaceOnce(source,"assert.equal((await db.query('select count(*)::int n from public.bookings')).rows[0].n,1);","assert.equal((await db.query('select count(*)::int n from public.bookings')).rows[0].n,4);");
    }else{
      const start=source.indexOf(" for(const file of readdirSync('supabase/migrations').filter(");
      const end=source.indexOf('\n for(const [role,a]',start);assert(start>0&&end>start);
      source=source.slice(0,start)+" await reconcileDb(db);\n evidence.migrations=readdirSync('supabase/migrations').sort().map(file=>({file}));"+source.slice(end);
      source=replaceOnce(source,"select id from public.booking_slots order by date,start_at limit 2","select id from public.booking_slots where date between current_date+1 and current_date+8 order by date,start_at limit 2");
    }
    mkdirSync('.local-postgres/reconciled-tests',{recursive:true});const path='.local-postgres/reconciled-tests/'+suite+'.test.mjs';writeFileSync(path,source);
    const result=spawnSync(process.execPath,['--test','--test-concurrency=1',path],{encoding:'utf8',windowsHide:true,env:{...process.env,GATE2_TEST_DATABASE_URL:url(dbName),GATE2_LOCAL_DATA_DIR:data},maxBuffer:10*1024*1024});
    const output=(result.stdout??'')+(result.stderr??'');writeFileSync('.local-postgres/reconciliation-'+suite+'.log',output);
    const summary=output.split(/\r?\n/).filter(s=>/^[#ℹ] (tests|pass|fail|skipped|duration_ms)|^Synthetic|^RACE/.test(s));console.log(suite+' '+summary.join('\n'));
    evidence.suites[suite]={exit_code:result.status,summary};
    if(result.status!==0){console.log(output.slice(-14000));throw Error('Reconciled '+suite+' failed');}
  }
}finally{
  evidence.finished_at=new Date().toISOString();writeFileSync('.local-postgres/reconciliation-evidence.json',JSON.stringify(evidence,null,2)+'\n');
  if(admin)await admin.end();run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
}
```



## Inspected schema inventories (source-derived, not live)

The complete before/after catalogues were obtained by loading main's schema and the release chain into separate fresh local databases, including columns/defaults/nullability, every constraint/FK, index, policy, trigger, function definition and explicit grants. All canonical function bodies and grants are frozen in 019. The original legacy bodies remain available in main's pinned schema and are retained privately at reconciliation. The inventories below describe source contracts, not the hosted project's uninspected permissions.

| Local source catalogue | Legacy main | Final 018 |
|---|---:|---:|
| Tables / columns | 14 / 122 | 22 / 229 |
| PK / unique / FK / CHECK | 14 / 8 / 7 / 9 | 22 / 20 / 18 / 66 |
| All indexes | 32 | 67 |
| RLS policies | 5 | 25 |
| User triggers | 1 | 17 |
| Business functions (extension functions excluded) | 7 | 30 |

### Every legacy column and canonical counterpart

The mapping section specifies every renamed, split, archived-only or generated value. The following lists include nullability and defaults for each source table and each final table so missing source fields are explicit. A question mark means nullable; an exclamation mark means non-null. A default is a database behavior, not owner approval.

**Legacy columns**

* `admin_profiles`: `id: uuid ! = gen_random_uuid()`; `user_id: uuid !`; `name: text !`; `role: text !`; `active: boolean ! = true`; `created_at: timestamp with time zone ! = now()`; `updated_at: timestamp with time zone ! = now()`.
* `app_settings`: `id: integer ! = 1`; `deposit_mode: text ! = 'fixed'::text`; `deposit_fixed: integer ! = 5000`; `deposit_percent: integer ! = 20`; `fitting_fee: integer ! = 2000`; `job_duration_mins: integer ! = 60`; `cancellation_policy: text ! = 'Free cancellation up to 48 hours before your appointment.'::text`; `business_phone: text ?`; `updated_at: timestamp with time zone ! = now()`.
* `audit_log`: `id: uuid ! = gen_random_uuid()`; `actor: text ?`; `action: text !`; `entity: text ?`; `entity_id: uuid ?`; `metadata: jsonb ?`; `created_at: timestamp with time zone ! = now()`.
* `booking_items`: `id: uuid ! = gen_random_uuid()`; `booking_id: uuid !`; `tyre_id: uuid ?`; `tyre_label: text !`; `quantity: integer !`; `unit_price: integer !`; `line_total: integer !`.
* `booking_slots`: `id: uuid ! = gen_random_uuid()`; `slot_date: date !`; `start_time: time without time zone !`; `end_time: time without time zone !`; `max_bookings: integer ! = 1`; `active: boolean ! = true`; `created_at: timestamp with time zone ! = now()`.
* `bookings`: `id: uuid ! = gen_random_uuid()`; `booking_ref: text !`; `manage_token: uuid ! = gen_random_uuid()`; `customer_id: uuid ?`; `slot_id: uuid ?`; `fitter_id: uuid ?`; `vehicle_reg: text ?`; `vehicle_make: text ?`; `vehicle_model: text ?`; `vehicle_derivative: text ?`; `fitting_address: text ?`; `fitting_postcode: text ?`; `customer_notes: text ?`; `admin_notes: text ?`; `status: text ! = 'pending_payment'::text`; `tyres_total: integer ! = 0`; `fitting_fee: integer ! = 0`; `callout_charge: integer ! = 0`; `total_amount: integer ! = 0`; `deposit_amount: integer ! = 0`; `balance_due: integer ! = 0`; `stripe_payment_intent_id: text ?`; `stripe_charge_id: text ?`; `deposit_paid_at: timestamp with time zone ?`; `created_at: timestamp with time zone ! = now()`; `updated_at: timestamp with time zone ! = now()`.
* `customers`: `id: uuid ! = gen_random_uuid()`; `name: text ?`; `email: text !`; `phone: text ?`; `address_line1: text ?`; `address_line2: text ?`; `city: text ?`; `postcode: text ?`; `created_at: timestamp with time zone ! = now()`.
* `fitters`: `id: uuid ! = gen_random_uuid()`; `name: text !`; `phone: text ?`; `active: boolean ! = true`; `created_at: timestamp with time zone ! = now()`.
* `interest_registrations`: `id: uuid ! = gen_random_uuid()`; `email: text !`; `postcode: text !`; `source: text ?`; `created_at: timestamp with time zone ! = now()`.
* `rate_limits`: `id: uuid ! = gen_random_uuid()`; `bucket_key: text !`; `window_start: timestamp with time zone ! = now()`; `hits: integer ! = 1`.
* `service_zones`: `id: uuid ! = gen_random_uuid()`; `postcode_prefix: text !`; `zone_name: text !`; `callout_charge: integer ! = 0`; `active: boolean ! = true`; `created_at: timestamp with time zone ! = now()`.
* `slot_holds`: `id: uuid ! = gen_random_uuid()`; `slot_id: uuid !`; `session_token: text !`; `expires_at: timestamp with time zone !`; `created_at: timestamp with time zone ! = now()`.
* `tyre_inventory`: `id: uuid ! = gen_random_uuid()`; `brand: text !`; `model: text !`; `sku: text !`; `width: integer !`; `profile: integer !`; `rim: integer !`; `load_index: text ?`; `speed_rating: text ?`; `is_run_flat: boolean ! = false`; `is_xl: boolean ! = false`; `season: text ! = 'summer'::text`; `tier: text ! = 'mid'::text`; `cost_price: integer !`; `sell_price: integer !`; `stock: integer ! = 0`; `wet_grip: text ?`; `fuel_economy: text ?`; `noise_db: integer ?`; `active: boolean ! = true`; `created_at: timestamp with time zone ! = now()`.
* `vrm_cache`: `id: uuid ! = gen_random_uuid()`; `registration: text !`; `payload: jsonb !`; `cached_at: timestamp with time zone ! = now()`.

**Canonical columns**

* `admin_profiles`: `id: uuid ! = gen_random_uuid()`; `user_id: uuid !`; `name: text !`; `role: text !`; `active: boolean ! = true`; `created_at: timestamp with time zone ! = now()`; `updated_at: timestamp with time zone ! = now()`.
* `audit_logs`: `id: uuid ! = gen_random_uuid()`; `admin_user_id: uuid ?`; `action: text !`; `resource_type: text !`; `resource_id: uuid ?`; `metadata: jsonb ! = '{}'::jsonb`; `created_at: timestamp with time zone ! = now()`; `before_state: jsonb ?`; `after_state: jsonb ?`.
* `availability_rules`: `id: uuid ! = gen_random_uuid()`; `day_of_week: integer !`; `start_time: time without time zone !`; `end_time: time without time zone !`; `slot_duration_minutes: integer !`; `capacity: integer !`; `active: boolean ! = true`.
* `blocked_dates`: `id: uuid ! = gen_random_uuid()`; `date: date !`; `reason: text ?`; `created_by: uuid ?`; `created_at: timestamp with time zone ! = now()`.
* `booking_items`: `id: uuid ! = gen_random_uuid()`; `booking_id: uuid !`; `tyre_product_id: uuid ?`; `sku_snapshot: text !`; `brand_snapshot: text !`; `model_snapshot: text !`; `size_snapshot: text !`; `quantity: integer !`; `unit_price_pence: integer !`; `line_total_pence: integer !`.
* `booking_slots`: `id: uuid ! = gen_random_uuid()`; `date: date !`; `start_at: time without time zone !`; `end_at: time without time zone !`; `capacity: integer !`; `active: boolean ! = true`; `blocked_reason: text ?`; `created_at: timestamp with time zone ! = now()`.
* `bookings`: `id: uuid ! = gen_random_uuid()`; `reference: text !`; `manage_token: uuid ! = gen_random_uuid()`; `customer_id: uuid ?`; `slot_id: uuid ?`; `fitter_id: uuid ?`; `service_zone_id: uuid ?`; `registration: text ?`; `vehicle_make: text ?`; `vehicle_model: text ?`; `vehicle_derivative: text ?`; `fitting_address: text !`; `postcode: text !`; `status: text ! = 'pending_payment'::text`; `subtotal_pence: integer ! = 0`; `fitting_fee_pence: integer ! = 0`; `callout_fee_pence: integer ! = 0`; `total_pence: integer ! = 0`; `deposit_pence: integer ! = 0`; `balance_pence: integer ! = 0`; `customer_notes: text ?`; `admin_notes: text ?`; `created_at: timestamp with time zone ! = now()`; `updated_at: timestamp with time zone ! = now()`; `checkout_key: uuid ?`; `checkout_fingerprint: text ?`; `bank_payment_expires_at: timestamp with time zone ?`; `booking_source: text ?`.
* `business_settings`: `id: smallint ! = 1`; `deposit_mode: text !`; `deposit_value: integer !`; `slot_hold_minutes: integer ! = 15`; `same_day_enabled: boolean ! = false`; `same_day_cutoff: time without time zone ?`; `booking_horizon_days: integer ! = 60`; `phone: text ?`; `email: text ?`; `whatsapp: text ?`; `vat_registered: boolean ! = false`; `vat_number: text ?`; `cancellation_notice_hours: integer ! = 48`; `updated_at: timestamp with time zone ! = now()`; `pricing_configured: boolean ! = false`; `fitting_fee_pence: integer ?`; `job_duration_minutes: integer ?`; `cancellation_policy: text ?`; `bank_payment_window_minutes: integer ?`; `bank_account_name: text ?`; `bank_name: text ?`; `sort_code: text ?`; `account_number: text ?`; `vat_rate_bps: integer ?`; `terms_and_conditions: text ?`; `privacy_policy: text ?`.
* `customers`: `id: uuid ! = gen_random_uuid()`; `first_name: text !`; `last_name: text !`; `email: text !`; `phone: text !`; `created_at: timestamp with time zone ! = now()`; `updated_at: timestamp with time zone ! = now()`.
* `email_outbox`: `id: uuid ! = gen_random_uuid()`; `booking_id: uuid ?`; `deduplication_key: text !`; `recipient: text !`; `template: text !`; `payload: jsonb ! = '{}'::jsonb`; `status: text ! = 'pending'::text`; `attempts: integer ! = 0`; `available_at: timestamp with time zone ! = now()`; `locked_at: timestamp with time zone ?`; `provider_message_id: text ?`; `sent_at: timestamp with time zone ?`; `last_error: text ?`; `created_at: timestamp with time zone ! = now()`; `updated_at: timestamp with time zone ! = now()`.
* `fitters`: `id: uuid ! = gen_random_uuid()`; `name: text !`; `phone: text ?`; `van_name: text ?`; `active: boolean ! = true`; `created_at: timestamp with time zone ! = now()`; `updated_at: timestamp with time zone ! = now()`.
* `interest_registrations`: `id: uuid ! = gen_random_uuid()`; `email: text !`; `postcode: text !`; `source: text ?`; `created_at: timestamp with time zone ! = now()`.
* `inventory`: `id: uuid ! = gen_random_uuid()`; `tyre_product_id: uuid !`; `stock_qty: integer ! = 0`; `reserved_qty: integer ! = 0`; `cost_price_pence: integer !`; `selling_price_pence: integer !`; `supplier_sku: text ?`; `low_stock_threshold: integer ! = 2`; `updated_at: timestamp with time zone ! = now()`.
* `inventory_holds`: `id: uuid ! = gen_random_uuid()`; `slot_hold_id: uuid !`; `tyre_product_id: uuid !`; `quantity: integer !`; `expires_at: timestamp with time zone !`; `created_at: timestamp with time zone ! = now()`.
* `payments`: `id: uuid ! = gen_random_uuid()`; `booking_id: uuid !`; `provider: text ! = 'manual'::text`; `stripe_checkout_session_id: text ?`; `stripe_payment_intent_id: text ?`; `type: text !`; `status: text !`; `amount_pence: integer !`; `currency: text ! = 'gbp'::text`; `created_at: timestamp with time zone ! = now()`; `succeeded_at: timestamp with time zone ?`; `payment_method: text ?`; `reference: text ?`; `paid_at: timestamp with time zone ?`; `verified_by_admin_id: uuid ?`; `bank_details: jsonb ?`; `updated_at: timestamp with time zone ! = now()`; `refunded_at: timestamp with time zone ?`; `refund_amount_pence: integer ?`; `refund_reference: text ?`; `refunded_by_admin_id: uuid ?`.
* `rate_limits`: `id: uuid ! = gen_random_uuid()`; `bucket_key: text !`; `hits: integer !`; `window_start: timestamp with time zone ! = now()`; `expires_at: timestamp with time zone !`.
* `service_zones`: `id: uuid ! = gen_random_uuid()`; `name: text !`; `postcode_prefix: text !`; `callout_fee_pence: integer ! = 0`; `active: boolean ! = true`; `priority: integer ! = 100`; `created_at: timestamp with time zone ! = now()`.
* `slot_holds`: `id: uuid ! = gen_random_uuid()`; `slot_id: uuid !`; `token: text !`; `expires_at: timestamp with time zone !`; `created_at: timestamp with time zone ! = now()`; `booking_id: uuid ?`.
* `special_dates`: `id: uuid ! = gen_random_uuid()`; `date: date !`; `start_time: time without time zone ?`; `end_time: time without time zone ?`; `slot_duration_minutes: integer ?`; `capacity: integer ?`; `active: boolean ! = true`; `note: text ?`; `created_at: timestamp with time zone ! = now()`; `updated_at: timestamp with time zone ! = now()`.
* `tyre_products`: `id: uuid ! = gen_random_uuid()`; `sku: text !`; `slug: text !`; `brand: text !`; `model: text !`; `width: integer !`; `profile: integer !`; `rim: integer !`; `load_index: text ?`; `speed_rating: text ?`; `run_flat: boolean ! = false`; `extra_load: boolean ! = false`; `season: text !`; `tier: text !`; `wet_grip_rating: text ?`; `fuel_efficiency_rating: text ?`; `noise_db: integer ?`; `image_url: text ?`; `active: boolean ! = true`; `created_at: timestamp with time zone ! = now()`; `updated_at: timestamp with time zone ! = now()`.
* `vrm_cache`: `id: uuid ! = gen_random_uuid()`; `lookup_hash: text !`; `encrypted_payload: bytea !`; `expires_at: timestamp with time zone !`; `created_at: timestamp with time zone ! = now()`.
* `webhook_events`: `id: uuid ! = gen_random_uuid()`; `provider: text !`; `event_id: text !`; `event_type: text !`; `processed_at: timestamp with time zone ! = now()`.

### Constraints and foreign keys

All legacy FKs stay on the original source objects. New public FKs target canonical objects or the same Auth IDs, never backup copies. Legacy customer email uniqueness is intentionally absent in the final contract. Slot uniqueness changes from date/start to date/start/end; hold tokens become unique; rate buckets consolidate to a unique key. New nonnegative price, end-after-start, payment/bank/refund and reservation consistency checks are enforced before any commit.

**Legacy constraints**

| Table | Constraint | Type | Definition |
|---|---|---|---|
| admin_profiles | admin_profiles_pkey | p | PRIMARY KEY (id) |
| admin_profiles | admin_profiles_role_check | c | CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text]))) |
| admin_profiles | admin_profiles_user_id_fkey | f | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| admin_profiles | admin_profiles_user_id_key | u | UNIQUE (user_id) |
| app_settings | app_settings_deposit_mode_check | c | CHECK ((deposit_mode = ANY (ARRAY['fixed'::text, 'percent'::text]))) |
| app_settings | app_settings_id_check | c | CHECK ((id = 1)) |
| app_settings | app_settings_pkey | p | PRIMARY KEY (id) |
| audit_log | audit_log_pkey | p | PRIMARY KEY (id) |
| booking_items | booking_items_booking_id_fkey | f | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE |
| booking_items | booking_items_pkey | p | PRIMARY KEY (id) |
| booking_items | booking_items_quantity_check | c | CHECK ((quantity > 0)) |
| booking_items | booking_items_tyre_id_fkey | f | FOREIGN KEY (tyre_id) REFERENCES tyre_inventory(id) ON DELETE SET NULL |
| booking_slots | booking_slots_max_bookings_check | c | CHECK ((max_bookings > 0)) |
| booking_slots | booking_slots_pkey | p | PRIMARY KEY (id) |
| booking_slots | booking_slots_slot_date_start_time_key | u | UNIQUE (slot_date, start_time) |
| bookings | bookings_booking_ref_key | u | UNIQUE (booking_ref) |
| bookings | bookings_customer_id_fkey | f | FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL |
| bookings | bookings_fitter_id_fkey | f | FOREIGN KEY (fitter_id) REFERENCES fitters(id) ON DELETE SET NULL |
| bookings | bookings_manage_token_key | u | UNIQUE (manage_token) |
| bookings | bookings_pkey | p | PRIMARY KEY (id) |
| bookings | bookings_slot_id_fkey | f | FOREIGN KEY (slot_id) REFERENCES booking_slots(id) ON DELETE SET NULL |
| bookings | bookings_status_check | c | CHECK ((status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'tyres_reserved'::text, 'fitter_assigned'::text, 'en_route'::text, 'completed'::text, 'cancelled'::text, 'refunded'::text, 'payment_failed'::text]))) |
| customers | customers_email_key | u | UNIQUE (email) |
| customers | customers_pkey | p | PRIMARY KEY (id) |
| fitters | fitters_pkey | p | PRIMARY KEY (id) |
| interest_registrations | interest_registrations_pkey | p | PRIMARY KEY (id) |
| rate_limits | rate_limits_pkey | p | PRIMARY KEY (id) |
| service_zones | service_zones_pkey | p | PRIMARY KEY (id) |
| service_zones | service_zones_postcode_prefix_key | u | UNIQUE (postcode_prefix) |
| slot_holds | slot_holds_pkey | p | PRIMARY KEY (id) |
| slot_holds | slot_holds_slot_id_fkey | f | FOREIGN KEY (slot_id) REFERENCES booking_slots(id) ON DELETE CASCADE |
| tyre_inventory | tyre_inventory_pkey | p | PRIMARY KEY (id) |
| tyre_inventory | tyre_inventory_season_check | c | CHECK ((season = ANY (ARRAY['summer'::text, 'all-season'::text, 'winter'::text]))) |
| tyre_inventory | tyre_inventory_sku_key | u | UNIQUE (sku) |
| tyre_inventory | tyre_inventory_stock_check | c | CHECK ((stock >= 0)) |
| tyre_inventory | tyre_inventory_tier_check | c | CHECK ((tier = ANY (ARRAY['budget'::text, 'mid'::text, 'premium'::text]))) |
| vrm_cache | vrm_cache_pkey | p | PRIMARY KEY (id) |
| vrm_cache | vrm_cache_registration_key | u | UNIQUE (registration) |

**Canonical constraints**

| Table | Constraint | Type | Definition |
|---|---|---|---|
| admin_profiles | admin_profiles_pkey | p | PRIMARY KEY (id) |
| admin_profiles | admin_profiles_role_check | c | CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'viewer'::text]))) |
| admin_profiles | admin_profiles_user_id_fkey | f | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| admin_profiles | admin_profiles_user_id_key | u | UNIQUE (user_id) |
| audit_logs | audit_logs_admin_user_id_fkey | f | FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL |
| audit_logs | audit_logs_pkey | p | PRIMARY KEY (id) |
| availability_rules | availability_rules_capacity_check | c | CHECK ((capacity > 0)) |
| availability_rules | availability_rules_check | c | CHECK ((end_time > start_time)) |
| availability_rules | availability_rules_day_of_week_check | c | CHECK (((day_of_week >= 0) AND (day_of_week <= 6))) |
| availability_rules | availability_rules_pkey | p | PRIMARY KEY (id) |
| availability_rules | availability_rules_slot_duration_minutes_check | c | CHECK ((slot_duration_minutes > 0)) |
| blocked_dates | blocked_dates_created_by_fkey | f | FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL |
| blocked_dates | blocked_dates_date_key | u | UNIQUE (date) |
| blocked_dates | blocked_dates_pkey | p | PRIMARY KEY (id) |
| booking_items | booking_items_booking_id_fkey | f | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE |
| booking_items | booking_items_line_total_pence_check | c | CHECK ((line_total_pence >= 0)) |
| booking_items | booking_items_pkey | p | PRIMARY KEY (id) |
| booking_items | booking_items_quantity_check | c | CHECK ((quantity > 0)) |
| booking_items | booking_items_tyre_product_id_fkey | f | FOREIGN KEY (tyre_product_id) REFERENCES tyre_products(id) ON DELETE SET NULL |
| booking_items | booking_items_unit_price_pence_check | c | CHECK ((unit_price_pence >= 0)) |
| booking_slots | booking_slots_capacity_check | c | CHECK ((capacity > 0)) |
| booking_slots | booking_slots_check | c | CHECK ((end_at > start_at)) |
| booking_slots | booking_slots_date_start_at_end_at_key | u | UNIQUE (date, start_at, end_at) |
| booking_slots | booking_slots_pkey | p | PRIMARY KEY (id) |
| bookings | bookings_awaiting_bank_check | c | CHECK (((status <> 'AWAITING_BANK_PAYMENT'::text) OR (checkout_key IS NOT NULL))) |
| bookings | bookings_balance_pence_check | c | CHECK ((balance_pence >= 0)) |
| bookings | bookings_bank_reservation_check | c | CHECK ((((checkout_key IS NULL) AND (checkout_fingerprint IS NULL) AND (bank_payment_expires_at IS NULL)) OR ((checkout_key IS NOT NULL) AND (checkout_fingerprint IS NOT NULL) AND (bank_payment_expires_at IS NOT NULL) AND (((subtotal_pence + (fitting_fee_pence)::bigint) + callout_fee_pence) = total_pence) AND ((deposit_pence + (balance_pence)::bigint) = total_pence)))) |
| bookings | bookings_booking_source_check | c | CHECK ((booking_source = ANY (ARRAY['online'::text, 'phone'::text]))) |
| bookings | bookings_callout_fee_pence_check | c | CHECK ((callout_fee_pence >= 0)) |
| bookings | bookings_checkout_key_key | u | UNIQUE (checkout_key) |
| bookings | bookings_customer_id_fkey | f | FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL |
| bookings | bookings_deposit_pence_check | c | CHECK ((deposit_pence >= 0)) |
| bookings | bookings_fitter_id_fkey | f | FOREIGN KEY (fitter_id) REFERENCES fitters(id) ON DELETE SET NULL |
| bookings | bookings_fitting_fee_pence_check | c | CHECK ((fitting_fee_pence >= 0)) |
| bookings | bookings_manage_token_key | u | UNIQUE (manage_token) |
| bookings | bookings_pkey | p | PRIMARY KEY (id) |
| bookings | bookings_reference_key | u | UNIQUE (reference) |
| bookings | bookings_service_zone_id_fkey | f | FOREIGN KEY (service_zone_id) REFERENCES service_zones(id) ON DELETE SET NULL |
| bookings | bookings_slot_id_fkey | f | FOREIGN KEY (slot_id) REFERENCES booking_slots(id) ON DELETE RESTRICT |
| bookings | bookings_status_check | c | CHECK ((status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'tyres_reserved'::text, 'fitter_assigned'::text, 'en_route'::text, 'completed'::text, 'cancelled'::text, 'refunded'::text, 'payment_failed'::text, 'AWAITING_BANK_PAYMENT'::text, 'EXPIRED'::text, 'CONFIRMED'::text]))) |
| bookings | bookings_subtotal_pence_check | c | CHECK ((subtotal_pence >= 0)) |
| bookings | bookings_total_pence_check | c | CHECK ((total_pence >= 0)) |
| business_settings | business_settings_account_number_check | c | CHECK (((account_number IS NULL) OR (account_number ~ '^[0-9]{8}$'::text))) |
| business_settings | business_settings_bank_account_name_check | c | CHECK (((bank_account_name IS NULL) OR ((length(btrim(bank_account_name)) >= 1) AND (length(btrim(bank_account_name)) <= 120)))) |
| business_settings | business_settings_bank_name_check | c | CHECK (((bank_name IS NULL) OR ((length(btrim(bank_name)) >= 1) AND (length(btrim(bank_name)) <= 120)))) |
| business_settings | business_settings_bank_window_check | c | CHECK (((bank_payment_window_minutes >= 1) AND (bank_payment_window_minutes <= 10080))) |
| business_settings | business_settings_booking_horizon_days_check | c | CHECK ((booking_horizon_days > 0)) |
| business_settings | business_settings_cancellation_notice_hours_check | c | CHECK ((cancellation_notice_hours >= 0)) |
| business_settings | business_settings_deposit_mode_check | c | CHECK ((deposit_mode = ANY (ARRAY['fixed'::text, 'percent'::text]))) |
| business_settings | business_settings_deposit_value_check | c | CHECK ((deposit_value >= 0)) |
| business_settings | business_settings_fitting_fee_pence_check | c | CHECK (((fitting_fee_pence IS NULL) OR (fitting_fee_pence >= 0))) |
| business_settings | business_settings_id_check | c | CHECK ((id = 1)) |
| business_settings | business_settings_job_duration_minutes_check | c | CHECK (((job_duration_minutes IS NULL) OR (job_duration_minutes > 0))) |
| business_settings | business_settings_percent_check | c | CHECK (((deposit_mode <> 'percent'::text) OR (deposit_value <= 100))) |
| business_settings | business_settings_pkey | p | PRIMARY KEY (id) |
| business_settings | business_settings_pricing_ready_check | c | CHECK (((NOT pricing_configured) OR ((fitting_fee_pence IS NOT NULL) AND (job_duration_minutes IS NOT NULL) AND (NULLIF(btrim(cancellation_policy), ''::text) IS NOT NULL)))) |
| business_settings | business_settings_slot_hold_minutes_check | c | CHECK (((slot_hold_minutes >= 1) AND (slot_hold_minutes <= 60))) |
| business_settings | business_settings_sort_code_check | c | CHECK (((sort_code IS NULL) OR (sort_code ~ '^[0-9]{6}$'::text))) |
| business_settings | business_settings_vat_rate_bps_check | c | CHECK (((vat_rate_bps IS NULL) OR ((vat_rate_bps >= 0) AND (vat_rate_bps <= 10000)))) |
| customers | customers_pkey | p | PRIMARY KEY (id) |
| email_outbox | email_outbox_attempts_check | c | CHECK ((attempts >= 0)) |
| email_outbox | email_outbox_booking_id_fkey | f | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT |
| email_outbox | email_outbox_check | c | CHECK (((status <> 'sent'::text) OR ((sent_at IS NOT NULL) AND (provider_message_id IS NOT NULL)))) |
| email_outbox | email_outbox_deduplication_key_key | u | UNIQUE (deduplication_key) |
| email_outbox | email_outbox_payload_check | c | CHECK ((jsonb_typeof(payload) = 'object'::text)) |
| email_outbox | email_outbox_pkey | p | PRIMARY KEY (id) |
| email_outbox | email_outbox_recipient_check | c | CHECK ((length(btrim(recipient)) > 0)) |
| email_outbox | email_outbox_status_check | c | CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text]))) |
| email_outbox | email_outbox_template_check | c | CHECK ((length(btrim(template)) > 0)) |
| fitters | fitters_pkey | p | PRIMARY KEY (id) |
| interest_registrations | interest_registrations_pkey | p | PRIMARY KEY (id) |
| inventory | inventory_check | c | CHECK (((reserved_qty >= 0) AND (reserved_qty <= stock_qty))) |
| inventory | inventory_cost_price_pence_check | c | CHECK ((cost_price_pence >= 0)) |
| inventory | inventory_low_stock_threshold_check | c | CHECK ((low_stock_threshold >= 0)) |
| inventory | inventory_pkey | p | PRIMARY KEY (id) |
| inventory | inventory_selling_price_pence_check | c | CHECK ((selling_price_pence >= 0)) |
| inventory | inventory_stock_qty_check | c | CHECK ((stock_qty >= 0)) |
| inventory | inventory_tyre_product_id_fkey | f | FOREIGN KEY (tyre_product_id) REFERENCES tyre_products(id) ON DELETE CASCADE |
| inventory | inventory_tyre_product_id_key | u | UNIQUE (tyre_product_id) |
| inventory_holds | inventory_holds_pkey | p | PRIMARY KEY (id) |
| inventory_holds | inventory_holds_quantity_check | c | CHECK ((quantity > 0)) |
| inventory_holds | inventory_holds_slot_hold_id_fkey | f | FOREIGN KEY (slot_hold_id) REFERENCES slot_holds(id) ON DELETE CASCADE |
| inventory_holds | inventory_holds_slot_hold_id_tyre_product_id_key | u | UNIQUE (slot_hold_id, tyre_product_id) |
| inventory_holds | inventory_holds_tyre_product_id_fkey | f | FOREIGN KEY (tyre_product_id) REFERENCES tyre_products(id) ON DELETE CASCADE |
| payments | payments_amount_pence_check | c | CHECK ((amount_pence >= 0)) |
| payments | payments_booking_id_fkey | f | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT |
| payments | payments_manual_check | c | CHECK (((provider <> 'manual'::text) OR ((payment_method IS NOT NULL) AND (payment_method = 'bank_transfer'::text) AND (status = ANY (ARRAY['pending'::text, 'received'::text, 'refunded'::text, 'cancelled'::text])) AND (currency = 'gbp'::text) AND (reference IS NOT NULL) AND (length(reference) > 0) AND (amount_pence > 0) AND (stripe_checkout_session_id IS NULL) AND (stripe_payment_intent_id IS NULL) AND (succeeded_at IS NULL) AND (bank_details IS NOT NULL) AND (jsonb_typeof(bank_details) = 'object'::text) AND (COALESCE(jsonb_typeof((bank_details -> 'bank_name'::text)), ''::text) = 'string'::text) AND (COALESCE(length((bank_details ->> 'bank_name'::text)), 0) > 0) AND (COALESCE(jsonb_typeof((bank_details -> 'bank_account_name'::text)), ''::text) = 'string'::text) AND (COALESCE(length((bank_details ->> 'bank_account_name'::text)), 0) > 0) AND (COALESCE((bank_details ->> 'sort_code'::text), ''::text) ~ '^[0-9]{6}$'::text) AND (COALESCE((bank_details ->> 'account_number'::text), ''::text) ~ '^[0-9]{8}$'::text) AND (((status = ANY (ARRAY['received'::text, 'refunded'::text])) AND (paid_at IS NOT NULL) AND (verified_by_admin_id IS NOT NULL)) OR ((status = ANY (ARRAY['pending'::text, 'cancelled'::text])) AND (paid_at IS NULL) AND (verified_by_admin_id IS NULL)))))) |
| payments | payments_manual_refund_details_check | c | CHECK (((provider <> 'manual'::text) OR ((status = 'refunded'::text) AND (refunded_at IS NOT NULL) AND (refund_amount_pence = amount_pence) AND (NULLIF(btrim(refund_reference), ''::text) IS NOT NULL) AND (refunded_by_admin_id IS NOT NULL)) OR ((status <> 'refunded'::text) AND (refunded_at IS NULL) AND (refund_amount_pence IS NULL) AND (refund_reference IS NULL) AND (refunded_by_admin_id IS NULL)))) |
| payments | payments_pkey | p | PRIMARY KEY (id) |
| payments | payments_refunded_by_admin_id_fkey | f | FOREIGN KEY (refunded_by_admin_id) REFERENCES admin_profiles(id) ON DELETE RESTRICT |
| payments | payments_status_check | c | CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text, 'received'::text]))) |
| payments | payments_stripe_checkout_session_id_key | u | UNIQUE (stripe_checkout_session_id) |
| payments | payments_stripe_payment_intent_id_key | u | UNIQUE (stripe_payment_intent_id) |
| payments | payments_type_check | c | CHECK ((type = ANY (ARRAY['deposit'::text, 'balance'::text, 'refund'::text]))) |
| payments | payments_verified_by_admin_id_fkey | f | FOREIGN KEY (verified_by_admin_id) REFERENCES admin_profiles(id) ON DELETE RESTRICT |
| rate_limits | rate_limits_bucket_key_key | u | UNIQUE (bucket_key) |
| rate_limits | rate_limits_check | c | CHECK ((expires_at > window_start)) |
| rate_limits | rate_limits_hits_check | c | CHECK ((hits >= 0)) |
| rate_limits | rate_limits_pkey | p | PRIMARY KEY (id) |
| service_zones | service_zones_callout_fee_pence_check | c | CHECK ((callout_fee_pence >= 0)) |
| service_zones | service_zones_pkey | p | PRIMARY KEY (id) |
| service_zones | service_zones_postcode_prefix_key | u | UNIQUE (postcode_prefix) |
| slot_holds | slot_holds_booking_id_fkey | f | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT |
| slot_holds | slot_holds_booking_id_key | u | UNIQUE (booking_id) |
| slot_holds | slot_holds_pkey | p | PRIMARY KEY (id) |
| slot_holds | slot_holds_slot_id_fkey | f | FOREIGN KEY (slot_id) REFERENCES booking_slots(id) ON DELETE CASCADE |
| slot_holds | slot_holds_token_key | u | UNIQUE (token) |
| special_dates | special_dates_capacity_check | c | CHECK (((capacity IS NULL) OR (capacity > 0))) |
| special_dates | special_dates_check | c | CHECK (((NOT active) OR ((start_time IS NOT NULL) AND (end_time IS NOT NULL) AND (end_time > start_time) AND (slot_duration_minutes IS NOT NULL) AND (capacity IS NOT NULL)))) |
| special_dates | special_dates_date_key | u | UNIQUE (date) |
| special_dates | special_dates_note_check | c | CHECK (((note IS NULL) OR ((length(btrim(note)) >= 1) AND (length(btrim(note)) <= 500)))) |
| special_dates | special_dates_pkey | p | PRIMARY KEY (id) |
| special_dates | special_dates_slot_duration_minutes_check | c | CHECK (((slot_duration_minutes IS NULL) OR (slot_duration_minutes > 0))) |
| tyre_products | tyre_products_noise_db_check | c | CHECK (((noise_db IS NULL) OR (noise_db >= 0))) |
| tyre_products | tyre_products_pkey | p | PRIMARY KEY (id) |
| tyre_products | tyre_products_profile_check | c | CHECK ((profile > 0)) |
| tyre_products | tyre_products_rim_check | c | CHECK ((rim > 0)) |
| tyre_products | tyre_products_season_check | c | CHECK ((season = ANY (ARRAY['summer'::text, 'all-season'::text, 'winter'::text]))) |
| tyre_products | tyre_products_sku_key | u | UNIQUE (sku) |
| tyre_products | tyre_products_slug_key | u | UNIQUE (slug) |
| tyre_products | tyre_products_tier_check | c | CHECK ((tier = ANY (ARRAY['budget'::text, 'standard'::text, 'premium'::text]))) |
| tyre_products | tyre_products_width_check | c | CHECK ((width > 0)) |
| vrm_cache | vrm_cache_lookup_hash_key | u | UNIQUE (lookup_hash) |
| vrm_cache | vrm_cache_pkey | p | PRIMARY KEY (id) |
| webhook_events | webhook_events_pkey | p | PRIMARY KEY (id) |
| webhook_events | webhook_events_provider_event_id_key | u | UNIQUE (provider, event_id) |

### Indexes

Legacy indexes remain on archived originals; canonical indexes are built from the frozen chain. No legacy index name is mistaken for a new public index.

**Legacy indexes**

| Table | Index definition |
|---|---|
| admin_profiles | CREATE UNIQUE INDEX admin_profiles_pkey ON public.admin_profiles USING btree (id) |
| admin_profiles | CREATE UNIQUE INDEX admin_profiles_user_id_key ON public.admin_profiles USING btree (user_id) |
| app_settings | CREATE UNIQUE INDEX app_settings_pkey ON public.app_settings USING btree (id) |
| audit_log | CREATE UNIQUE INDEX audit_log_pkey ON public.audit_log USING btree (id) |
| booking_items | CREATE UNIQUE INDEX booking_items_pkey ON public.booking_items USING btree (id) |
| booking_items | CREATE INDEX idx_items_booking ON public.booking_items USING btree (booking_id) |
| booking_slots | CREATE UNIQUE INDEX booking_slots_pkey ON public.booking_slots USING btree (id) |
| booking_slots | CREATE UNIQUE INDEX booking_slots_slot_date_start_time_key ON public.booking_slots USING btree (slot_date, start_time) |
| booking_slots | CREATE INDEX idx_slots_date ON public.booking_slots USING btree (slot_date) WHERE (active = true) |
| bookings | CREATE UNIQUE INDEX bookings_booking_ref_key ON public.bookings USING btree (booking_ref) |
| bookings | CREATE UNIQUE INDEX bookings_manage_token_key ON public.bookings USING btree (manage_token) |
| bookings | CREATE UNIQUE INDEX bookings_pkey ON public.bookings USING btree (id) |
| bookings | CREATE INDEX idx_bookings_pi ON public.bookings USING btree (stripe_payment_intent_id) |
| bookings | CREATE INDEX idx_bookings_slot ON public.bookings USING btree (slot_id) |
| bookings | CREATE INDEX idx_bookings_status ON public.bookings USING btree (status) |
| bookings | CREATE INDEX idx_bookings_token ON public.bookings USING btree (manage_token) |
| customers | CREATE UNIQUE INDEX customers_email_key ON public.customers USING btree (email) |
| customers | CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id) |
| fitters | CREATE UNIQUE INDEX fitters_pkey ON public.fitters USING btree (id) |
| interest_registrations | CREATE UNIQUE INDEX interest_registrations_pkey ON public.interest_registrations USING btree (id) |
| rate_limits | CREATE INDEX idx_rate_bucket ON public.rate_limits USING btree (bucket_key, window_start) |
| rate_limits | CREATE UNIQUE INDEX rate_limits_pkey ON public.rate_limits USING btree (id) |
| service_zones | CREATE UNIQUE INDEX service_zones_pkey ON public.service_zones USING btree (id) |
| service_zones | CREATE UNIQUE INDEX service_zones_postcode_prefix_key ON public.service_zones USING btree (postcode_prefix) |
| slot_holds | CREATE INDEX idx_holds_expires ON public.slot_holds USING btree (expires_at) |
| slot_holds | CREATE INDEX idx_holds_slot ON public.slot_holds USING btree (slot_id) |
| slot_holds | CREATE UNIQUE INDEX slot_holds_pkey ON public.slot_holds USING btree (id) |
| tyre_inventory | CREATE INDEX idx_tyre_size ON public.tyre_inventory USING btree (width, profile, rim) WHERE (active = true) |
| tyre_inventory | CREATE UNIQUE INDEX tyre_inventory_pkey ON public.tyre_inventory USING btree (id) |
| tyre_inventory | CREATE UNIQUE INDEX tyre_inventory_sku_key ON public.tyre_inventory USING btree (sku) |
| vrm_cache | CREATE UNIQUE INDEX vrm_cache_pkey ON public.vrm_cache USING btree (id) |
| vrm_cache | CREATE UNIQUE INDEX vrm_cache_registration_key ON public.vrm_cache USING btree (registration) |

**Canonical indexes**

| Table | Index definition |
|---|---|
| admin_profiles | CREATE UNIQUE INDEX admin_profiles_pkey ON public.admin_profiles USING btree (id) |
| admin_profiles | CREATE UNIQUE INDEX admin_profiles_user_id_key ON public.admin_profiles USING btree (user_id) |
| admin_profiles | CREATE INDEX idx_admin_profiles_user_id ON public.admin_profiles USING btree (user_id) |
| audit_logs | CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id) |
| audit_logs | CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC) |
| availability_rules | CREATE UNIQUE INDEX availability_rules_pkey ON public.availability_rules USING btree (id) |
| blocked_dates | CREATE UNIQUE INDEX blocked_dates_date_key ON public.blocked_dates USING btree (date) |
| blocked_dates | CREATE UNIQUE INDEX blocked_dates_pkey ON public.blocked_dates USING btree (id) |
| booking_items | CREATE UNIQUE INDEX booking_items_pkey ON public.booking_items USING btree (id) |
| booking_items | CREATE INDEX idx_booking_items_booking_id ON public.booking_items USING btree (booking_id) |
| booking_slots | CREATE UNIQUE INDEX booking_slots_date_start_at_end_at_key ON public.booking_slots USING btree (date, start_at, end_at) |
| booking_slots | CREATE UNIQUE INDEX booking_slots_pkey ON public.booking_slots USING btree (id) |
| booking_slots | CREATE INDEX idx_booking_slots_date_active ON public.booking_slots USING btree (date, active) |
| bookings | CREATE UNIQUE INDEX bookings_checkout_key_key ON public.bookings USING btree (checkout_key) |
| bookings | CREATE UNIQUE INDEX bookings_manage_token_key ON public.bookings USING btree (manage_token) |
| bookings | CREATE UNIQUE INDEX bookings_pkey ON public.bookings USING btree (id) |
| bookings | CREATE UNIQUE INDEX bookings_reference_key ON public.bookings USING btree (reference) |
| bookings | CREATE INDEX idx_bookings_bank_expiry ON public.bookings USING btree (bank_payment_expires_at) WHERE (status = 'AWAITING_BANK_PAYMENT'::text) |
| bookings | CREATE INDEX idx_bookings_created_at ON public.bookings USING btree (created_at DESC) |
| bookings | CREATE INDEX idx_bookings_reference ON public.bookings USING btree (reference) |
| bookings | CREATE INDEX idx_bookings_slot_id ON public.bookings USING btree (slot_id) |
| bookings | CREATE INDEX idx_bookings_status ON public.bookings USING btree (status) |
| business_settings | CREATE UNIQUE INDEX business_settings_pkey ON public.business_settings USING btree (id) |
| customers | CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id) |
| customers | CREATE INDEX idx_customers_email ON public.customers USING btree (lower(email)) |
| email_outbox | CREATE UNIQUE INDEX email_outbox_deduplication_key_key ON public.email_outbox USING btree (deduplication_key) |
| email_outbox | CREATE UNIQUE INDEX email_outbox_pkey ON public.email_outbox USING btree (id) |
| email_outbox | CREATE INDEX idx_email_outbox_booking ON public.email_outbox USING btree (booking_id) |
| email_outbox | CREATE INDEX idx_email_outbox_dispatch ON public.email_outbox USING btree (status, available_at) |
| fitters | CREATE UNIQUE INDEX fitters_pkey ON public.fitters USING btree (id) |
| interest_registrations | CREATE UNIQUE INDEX interest_registrations_pkey ON public.interest_registrations USING btree (id) |
| inventory | CREATE INDEX idx_inventory_product ON public.inventory USING btree (tyre_product_id) |
| inventory | CREATE UNIQUE INDEX inventory_pkey ON public.inventory USING btree (id) |
| inventory | CREATE UNIQUE INDEX inventory_tyre_product_id_key ON public.inventory USING btree (tyre_product_id) |
| inventory_holds | CREATE INDEX idx_inventory_holds_expires_at ON public.inventory_holds USING btree (expires_at) |
| inventory_holds | CREATE INDEX idx_inventory_holds_live_product ON public.inventory_holds USING btree (tyre_product_id, expires_at) |
| inventory_holds | CREATE INDEX idx_inventory_holds_product ON public.inventory_holds USING btree (tyre_product_id) |
| inventory_holds | CREATE UNIQUE INDEX inventory_holds_pkey ON public.inventory_holds USING btree (id) |
| inventory_holds | CREATE UNIQUE INDEX inventory_holds_slot_hold_id_tyre_product_id_key ON public.inventory_holds USING btree (slot_hold_id, tyre_product_id) |
| payments | CREATE INDEX idx_payments_booking_id ON public.payments USING btree (booking_id) |
| payments | CREATE UNIQUE INDEX idx_payments_manual_booking ON public.payments USING btree (booking_id) WHERE (provider = 'manual'::text) |
| payments | CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id) |
| payments | CREATE UNIQUE INDEX payments_stripe_checkout_session_id_key ON public.payments USING btree (stripe_checkout_session_id) |
| payments | CREATE UNIQUE INDEX payments_stripe_payment_intent_id_key ON public.payments USING btree (stripe_payment_intent_id) |
| rate_limits | CREATE INDEX idx_rate_limits_expires_at ON public.rate_limits USING btree (expires_at) |
| rate_limits | CREATE UNIQUE INDEX rate_limits_bucket_key_key ON public.rate_limits USING btree (bucket_key) |
| rate_limits | CREATE UNIQUE INDEX rate_limits_pkey ON public.rate_limits USING btree (id) |
| service_zones | CREATE INDEX idx_service_zones_prefix_priority ON public.service_zones USING btree (postcode_prefix, priority) WHERE (active = true) |
| service_zones | CREATE UNIQUE INDEX service_zones_pkey ON public.service_zones USING btree (id) |
| service_zones | CREATE UNIQUE INDEX service_zones_postcode_prefix_key ON public.service_zones USING btree (postcode_prefix) |
| slot_holds | CREATE INDEX idx_slot_holds_expires_at ON public.slot_holds USING btree (expires_at) |
| slot_holds | CREATE INDEX idx_slot_holds_slot ON public.slot_holds USING btree (slot_id) |
| slot_holds | CREATE UNIQUE INDEX slot_holds_booking_id_key ON public.slot_holds USING btree (booking_id) |
| slot_holds | CREATE UNIQUE INDEX slot_holds_pkey ON public.slot_holds USING btree (id) |
| slot_holds | CREATE UNIQUE INDEX slot_holds_token_key ON public.slot_holds USING btree (token) |
| special_dates | CREATE INDEX idx_special_dates_date_active ON public.special_dates USING btree (date, active) |
| special_dates | CREATE UNIQUE INDEX special_dates_date_key ON public.special_dates USING btree (date) |
| special_dates | CREATE UNIQUE INDEX special_dates_pkey ON public.special_dates USING btree (id) |
| tyre_products | CREATE INDEX idx_tyre_products_size ON public.tyre_products USING btree (width, profile, rim) WHERE (active = true) |
| tyre_products | CREATE UNIQUE INDEX tyre_products_pkey ON public.tyre_products USING btree (id) |
| tyre_products | CREATE UNIQUE INDEX tyre_products_sku_key ON public.tyre_products USING btree (sku) |
| tyre_products | CREATE UNIQUE INDEX tyre_products_slug_key ON public.tyre_products USING btree (slug) |
| vrm_cache | CREATE INDEX idx_vrm_cache_lookup_expires ON public.vrm_cache USING btree (lookup_hash, expires_at) |
| vrm_cache | CREATE UNIQUE INDEX vrm_cache_lookup_hash_key ON public.vrm_cache USING btree (lookup_hash) |
| vrm_cache | CREATE UNIQUE INDEX vrm_cache_pkey ON public.vrm_cache USING btree (id) |
| webhook_events | CREATE UNIQUE INDEX webhook_events_pkey ON public.webhook_events USING btree (id) |
| webhook_events | CREATE UNIQUE INDEX webhook_events_provider_event_id_key ON public.webhook_events USING btree (provider, event_id) |

### RLS policies, functions, triggers and grants

The legacy settings/slots public-read policies are not brought forward. Archived policies have no runtime schema/table grants. Canonical reads and server-only mutation rules are those of 011/014–018, verified by the embedded catalogue assertions. Main declares no explicit runtime GRANT statements; actual Supabase default ACLs therefore require live inspection and are never inferred from this source-only baseline.

**Legacy RLS policies**

| Table / policy | Roles / operation | Condition |
|---|---|---|
| admin_profiles / users read own admin profile | {authenticated} / SELECT | (auth.uid() = user_id) |
| app_settings / public reads settings | {anon,authenticated} / SELECT | true |
| booking_slots / public reads active slots | {anon,authenticated} / SELECT | (active = true) |
| service_zones / public reads active zones | {anon,authenticated} / SELECT | (active = true) |
| tyre_inventory / public reads active tyres | {anon,authenticated} / SELECT | (active = true) |

**Legacy functions**

| Signature | Security definer | Search path setting | Explicit ACL |
|---|---|---|---|
| confirm_booking_paid(text,text) | false | NULL | NULL |
| create_slot_hold(uuid,text,integer) | false | NULL | NULL |
| next_booking_ref() | false | NULL | NULL |
| purge_expired_holds() | false | NULL | NULL |
| refund_booking(text) | false | NULL | NULL |
| slot_remaining(uuid) | false | NULL | NULL |
| touch_updated_at() | false | NULL | NULL |

**Legacy triggers**

| Table / trigger | Definition |
|---|---|
| bookings / bookings_touch | CREATE TRIGGER bookings_touch BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION touch_updated_at() |

**Canonical RLS policies**

| Table / policy | Roles / operation | Condition |
|---|---|---|
| admin_profiles / admin_profiles_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| admin_profiles / admin_profiles_self_read | {authenticated} / SELECT | ((user_id = ( SELECT auth.uid() AS uid)) AND has_live_session()) |
| audit_logs / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| availability_rules / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| blocked_dates / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| booking_items / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| booking_slots / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| bookings / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| business_settings / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| customers / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| email_outbox / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| fitters / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| interest_registrations / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| inventory / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| inventory_holds / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| payments / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| rate_limits / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| service_zones / service_zones_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| service_zones / service_zones_public_read | {anon,authenticated} / SELECT | (active = true) |
| slot_holds / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| special_dates / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| tyre_products / tyre_products_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| tyre_products / tyre_products_public_read | {anon,authenticated} / SELECT | (active = true) |
| vrm_cache / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |
| webhook_events / active_admin_read | {authenticated} / SELECT | is_active_admin(( SELECT auth.uid() AS uid)) |

**Canonical functions**

| Signature | Security definer | Search path setting | Explicit ACL |
|---|---|---|---|
| admin_claim_bank_email(uuid,uuid,uuid) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| admin_extend_bank_window(uuid,uuid,uuid,integer,text,timestamp with time zone) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| admin_os_audit(uuid,text,text,uuid,jsonb,jsonb,jsonb) | true | search_path="" | {postgres=X/postgres} |
| admin_os_import_products(uuid,uuid,jsonb) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| admin_os_mutate(uuid,uuid,text,jsonb) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| admin_reserve_phone_booking(uuid,uuid,uuid,uuid,jsonb,jsonb,text,jsonb,text) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| admin_session_context() | true | search_path="" | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} |
| admin_set_inventory(uuid,uuid,uuid,integer,integer) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| admin_verify_bank_payment(uuid,uuid,uuid,integer) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| assert_bank_operator(uuid,uuid,boolean) | true | search_path="" | {postgres=X/postgres} |
| complete_admin_audit() | false | search_path="" | {postgres=X/postgres} |
| consume_rate_limit(text,integer,integer) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| expire_unpaid_bookings() | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| finish_bank_email(uuid,integer,text) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| guard_audit_history() | false | search_path="" | {postgres=X/postgres} |
| guard_bank_booking() | false | search_path="" | {postgres=X/postgres} |
| guard_booking_items() | false | search_path="" | {postgres=X/postgres} |
| guard_inventory_holds_stock() | true | search_path="" | {postgres=X/postgres} |
| guard_manual_payment() | false | search_path="" | {postgres=X/postgres} |
| guard_slot_capacity() | true | search_path="" | {postgres=X/postgres} |
| has_live_session() | true | search_path="" | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} |
| is_active_admin(uuid) | true | search_path="" | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} |
| live_inventory_held(uuid) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| owner_import_business_data(uuid,uuid,text,jsonb) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| owner_provision_admin(uuid,uuid,uuid,text,text) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| owner_set_admin_access(uuid,uuid,uuid,text,boolean) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| owner_set_bank_settings(uuid,uuid,text,text,text,text,integer) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| reserve_booking_checkout(uuid,uuid,jsonb,jsonb,text,jsonb,text) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |
| set_updated_at() | false | search_path=public, pg_catalog | {postgres=X/postgres} |
| slot_consumption(uuid) | true | search_path="" | {postgres=X/postgres,service_role=X/postgres} |

**Canonical triggers**

| Table / trigger | Definition |
|---|---|
| admin_profiles / admin_profiles_set_updated_at | CREATE TRIGGER admin_profiles_set_updated_at BEFORE UPDATE ON public.admin_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| audit_logs / audit_logs_complete | CREATE TRIGGER audit_logs_complete BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION complete_admin_audit() |
| audit_logs / audit_logs_immutable | CREATE TRIGGER audit_logs_immutable BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION guard_audit_history() |
| booking_items / booking_items_immutable | CREATE TRIGGER booking_items_immutable BEFORE DELETE OR UPDATE ON public.booking_items FOR EACH ROW EXECUTE FUNCTION guard_booking_items() |
| booking_slots / booking_slots_live_reservations | CREATE TRIGGER booking_slots_live_reservations BEFORE UPDATE ON public.booking_slots FOR EACH ROW EXECUTE FUNCTION guard_slot_capacity() |
| bookings / bookings_bank_terms_immutable | CREATE TRIGGER bookings_bank_terms_immutable BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION guard_bank_booking() |
| bookings / bookings_set_updated_at | CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| business_settings / business_settings_set_updated_at | CREATE TRIGGER business_settings_set_updated_at BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| customers / customers_set_updated_at | CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| email_outbox / email_outbox_set_updated_at | CREATE TRIGGER email_outbox_set_updated_at BEFORE UPDATE ON public.email_outbox FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| fitters / fitters_set_updated_at | CREATE TRIGGER fitters_set_updated_at BEFORE UPDATE ON public.fitters FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| inventory / inventory_live_reservations | CREATE TRIGGER inventory_live_reservations BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION guard_inventory_holds_stock() |
| inventory / inventory_set_updated_at | CREATE TRIGGER inventory_set_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| payments / payments_manual_immutable | CREATE TRIGGER payments_manual_immutable BEFORE DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION guard_manual_payment() |
| payments / payments_set_updated_at | CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| special_dates / special_dates_set_updated_at | CREATE TRIGGER special_dates_set_updated_at BEFORE UPDATE ON public.special_dates FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| tyre_products / tyre_products_set_updated_at | CREATE TRIGGER tyre_products_set_updated_at BEFORE UPDATE ON public.tyre_products FOR EACH ROW EXECUTE FUNCTION set_updated_at() |

Final ordinary authenticated reads are SELECT + RLS only. Final service_role table privileges support trusted server transactions and bypass RLS; that role is not a browser identity. Final anon product grants exclude cost/stock and creation timestamps; anon zone grants expose only ID/name/prefix/callout/active/priority. No other table-level public read is intentionally granted. Exact per-column grants, function grants, policies and search paths are asserted inside the transaction, so inherited/default grants that weaken the boundary fail verification.

### Frozen DDL provenance

| Migration source | SHA256 |
|---|---|
| 001_extensions.sql | 9a668f2e5c3620e6e4eb7ee03362ad73e7bcfea66c204671e6b7af4c2e7d4985 |
| 002_admin_profiles.sql | 551adb2d235ef77b27368edd17406bbe3f156936075386610211505d37e230f5 |
| 003_customers.sql | 0b6001644a9536aa45bec80434b3b8d10e174f193c0ccaa2f3134c6231e4cf1a |
| 004_service_zones.sql | 5aa52fbdbd1b3c66eeb8f3ad2cf362826d82cdaca3debc140f26dfdf1f7f04cd |
| 005_catalogue.sql | 174aa162ffbb9407466332f93e009ea02586c1d4dbe305c6816bdc9680771052 |
| 006_availability.sql | 04e5529cbcded17e1e764dbb1c1196fd68c3b844de15eb889b064c830e1e3644 |
| 007_booking_resources.sql | ca368b6dac6e104c820792e42c0f60430d745c4c205f7b98705c6b345594bd29 |
| 008_bookings.sql | 9f60bb705a75f604637913115f44acf36361a1af9b670c1a5ae712dcea2b08ac |
| 009_payments.sql | 4960a9c589e22fb2db7285537fe407e83813bc2778bd7cb66b735ec82f7ad69c |
| 010_operations.sql | af87f01185e0cd904e129969740c4534fe4e6602716a8879b668dc36351e5cdb |
| 011_rls.sql | 5f7bc4ca7014c061202295e50ec642f48c8b7c9aa7ebc0c08523c145bdf416b1 |
| 012_indexes.sql | 91158fce7bebbcd9731f532f30ae54e29d3d833f53a1981ef1a67f667b096975 |
| 013_gate0_canonical_foundation.sql | 298538a74e6b807bb858828148c7827aad9ca919a947709483978087653c3705 |
| 014_gate0_access_boundary.sql | aecf05c8f213a09860179fef4a652f0d42c3b6489b2395b24a4f62d3aeb868fc |
| 015_gate1_owner_business_data.sql | 30e738d08316568c511d2fc74294d92fc0c150454e1a4dbc40e74edce4f0b58a |
| 016_gate2_atomic_booking.sql | 5bb212a75a022ba6d65565438c1502dab316da5a046045a9356c300494317fef |
| 017_gate3_manual_bank_payments.sql | dc5995dfe10ab9b7582f843e3d68b0cad45deb687144fd39e41a39705aeceedb |
| 018_gate4_admin_operating_system.sql | bb2e73a952a753b2187b986634e7f16739770162aac8f15a91157326612e63ad |

Migration 010 has only the explicitly documented relation-scoping correction in the embedded DDL. All other frozen blocks are byte-equivalent to their source. Canonical assertions are copied from phase1_catalog_checks.sql without its outer BEGIN/ROLLBACK; no nested transaction is relied upon.
