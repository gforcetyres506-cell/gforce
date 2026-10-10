# Gate 1 - real search, coverage and catalogue

Date: 2026-10-10. Branch: gate/1-real-data.
Starting HEAD: 7dcc8d8035e4fdb48788378024da8f6076ff8b54.

**GATE 1 BLOCKED - owner data and account-specific provider proof missing.**
This is a reviewable local implementation, not a verified live integration.
No supplied zones, catalogue, OneAuto account documentation, sandbox credentials,
approved test VRM/postcodes, Supabase target or Turnstile keys were available.
No cloud project was changed and no provider vehicle lookup was performed.

## Implemented locally

- Postcodes.io lookup validates a full postcode and returns its normalized
  postcode/outcode. It does not decide G Force coverage or prices.
- Coverage queries active service_zones using exact outward-code equality.
  E1 cannot match E14. Lower priority values sort first; outward codes are
  unique in the canonical database. Unknown zones remain uncovered.
- Owner-controlled records enter through /admin/data or /api/admin/data.
  Auth, current session, active owner role and same-origin checks precede
  the privileged server client. The database rechecks owner/session, saves
  each batch and its audit records in one transaction. Browser roles cannot
  execute the import function or write tables directly.
- Forward migration 015 adds only this import function/grants. Migrations
  001-014 are preserved. Schema verification and disposable reset tooling
  now cover the full 001-015 chain; existing Gate 0 cloud gates still apply.
- Public products use canonical tyre_products plus inventory, actual prices
  and available stock (stock minus reserved). Costs/supplier details stay
  private. Labels and owner-provided HTTPS image are mapped; absent images
  have no substitute. Zero stock has no booking CTA.
- No seed, fallback or example catalogue is exposed. A genuinely empty
  database returns an empty catalogue. Unconfigured/unavailable databases
  return service unavailable, never empty-success or fictional products.
  Removed fixed size suggestions that did not come from the catalogue.
- Staggered results require explicit FRONT, REAR or BOTH choice and a
  physical sidewall checkbox. Changing axle clears confirmation. BOTH
  carries both dimensions through catalogue filtering into booking, where
  the customer must select a matching rear product deliberately.
- The finder sends a Turnstile widget token. Server Siteverify checks HTTP
  success, token success, action vrm_lookup and the configured APP_URL hostname.
  Missing config/token, expired/replayed token, schema/network failure or
  public test secret all deny lookup. No development bypass.
- Durable consume_rate_limit uses a unique bucket plus row lock in one SQL
  transaction. Per-IP ceiling: 3 accepted attempts / 10 minutes. Shared
  covered-lookup ceiling: 30 / 10 minutes, limiting spend even if IPs rotate.
  Bot verification, per-IP limiter, postcode normalization and database
  coverage all precede a provider call. Limiter/database failure denies it.

## Owner data contract

The admin form starts empty. Paste an approved JSON array, validate, inspect
the complete normalized records, then save. Maximum 500 rows / 1 MB per batch.
The API POST body is an object with kind ("zones" or "catalogue") and rows.
No defaults are supplied for business fields. All listed fields are required;
nullable fields must explicitly contain null when unknown.

Zones: postcode_prefix (an outward postcode, uppercased on validation), name,
callout_fee_pence, priority, active. Postcode wildcards and partial areas are
rejected. Update existing outward codes to change fee/priority/active; do not
delete useful records.

Catalogue: sku, brand, model, width, profile, rim, load_index (nullable),
speed_rating (nullable), run_flat, extra_load, season (summer/all-season/winter),
tier (budget/standard/premium), wet_grip_rating (A-E or null),
fuel_efficiency_rating (A-E or null), noise_db (nullable), image_url (HTTPS or
null), active, inventory. The stable slug is derived from SKU bytes; it is
an identifier, not an invented business value.

Inventory object: selling_price_pence (positive), cost_price_pence,
stock_qty, reserved_qty, supplier_sku (nullable), low_stock_threshold.
All amounts/counts are nonnegative integers. Reserved stock must equal the
current persisted value; new products must have zero reservations. Imports
never modify reservations. Changes concurrent with reservation activity
can reject the batch; reload and review current stock before retrying.
Inactive products/zones remain stored. Unmentioned rows remain unchanged.

Owner-only GET /api/admin/data returns current zone and product/inventory
records, including private costs for the owner. Supabase response row limits
still apply; this endpoint is an inspection aid, not a full backup/export tool.
There is no CSV coercion, inferred prices, mass-delete, cloud importer or
automatic business-data creation.

## OneAuto status and evidence

**BLOCKED / ADAPTER NOT IMPLEMENTED.** Removed the guessed /tyres?vrm=
transport, apikey header and speculative response-field aliases. lookupVRM
currently returns no vehicle even if ONEAUTO_API_KEY is present, which
forces manual size. No environment flag can enable a guessed adapter.

The provider's current public service page was inspected on 2026-10-10.
It documents /driverightdata/oetyrefitmentdata, vehicle_registration_mark,
x-api-key and separate sandbox.oneautoapi.com. This contradicts the retired
transport, but does not establish this G Force account's subscribed product,
contract version, response shape or sandbox entitlement:
[OneAuto OE Wheel & Tyre Fitments](https://www.oneautoapi.com/service/driverightdata-oe-wheel-tyre-fitments/).

Before enabling lookup, obtain the actual account documentation and an
authorized sandbox key/test VRM. Implement that exact request and a strict
normalizer with redacted provider evidence. No result, alternative fitments,
ambiguity, unexpected schema, timeout and provider errors must all yield
manual size. Do not choose the first vehicle or first wheel option. Do not
treat browser test fixtures as provider evidence.

Sources used for the implemented noncommercial integrations:
[Postcodes.io lookup](https://postcodes.io/docs/api/lookup-postcode/),
[Turnstile server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[Turnstile widget lifecycle](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/),
[Turnstile test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Acceptance

| Requirement | Result | Evidence / blocker |
| --- | --- | --- |
| Real covered postcode | BLOCKED | No owner-approved zones, test postcode or live DB supplied |
| Real uncovered postcode | BLOCKED | Exact-match rejection locally tested; live owner boundary unavailable |
| Real VRM in provider sandbox | BLOCKED | Account contract, credentials and approved test VRM missing |
| Provider failure leads to manual size | LOCAL PASS | Unverified adapter returns null; browser and helper tests; no provider live proof |
| Real product search | BLOCKED | No owner-approved catalogue or live database supplied |
| No fake catalogue rows | LOCAL PASS | Fresh migrations insert no products/zones; empty API and no-DB browser checks |
| Owner import / reservation safety | LOCAL PASS | SQL engine tests cover RBAC, grants, rollback, audit and reservation preservation |
| Turnstile / limiter | LOCAL PASS | Isolated API/widget tests and PostgreSQL atomic counter tests; live Cloudflare/proxy deployment unverified |

## Verification

| Local check | Result |
| --- | --- |
| npm run typecheck | PASS |
| npm run lint | PASS, zero errors; four pre-existing unused-variable warnings |
| npm run build | PASS, executed by Playwright webServer before browser checks |
| npm run test:security | PASS |
| npm run test:reliability | 76/76 PASS |
| npm run test:database | 16/16 PASS, full 001-015 replay and catalogue/security checks |
| npm run test:ui | 147/147 PASS at 360, 375, 390, 430, 768, 1366 and 1440px |
| Compiled browser secret identifier scan | 68 JS/map files; service-role key occurrences = 0 |
| git diff --check | PASS |

The first browser run exposed a case-sensitive test selector; it was corrected
and the complete 147-test suite rerun successfully. No application exception
or provider success was substituted to make that test pass.
Tests use only isolated fixtures: no production injection flag, no paid
provider request, no cloud Auth or database writes. PostgreSQL/WASM proves
SQL behavior locally; it does not prove Supabase Auth/PostgREST/cloud behavior.

## Remaining release work

1. Supply owner-approved zone and catalogue records with source/approval
   provenance, the current OneAuto account docs, ignored sandbox secrets,
   and real test cases. Keep secrets and private supplier files out of Git.
2. Complete the exact account adapter and strict response normalization.
3. Authorize the exact disposable Supabase project, replay 001-015 from zero
   using the existing attestation gates, and rerun Gate 0 live acceptance.
4. Supply real Turnstile site/secret keys and configure its permitted host.
   Verify proxy-overwritten client-address headers in the chosen deployment.
5. Load approved records through the owner route and verify all six real-data
   acceptance scenarios. Preserve evidence without keys or personal VRM data.

Gate 1 must remain BLOCKED until these live checks pass.
