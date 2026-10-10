# G FORCE TYRES - Canonical architecture

Date: 2026-10-10. Branch: gate/0-live-supabase.
Status: implemented and tested locally; cloud acceptance BLOCKED.
Starting HEAD: 545bac195fcabdd71e722a4412baa6dbd0dc05cd.

Use only ordered SQL in supabase/migrations/001-014. The original 001-012
files are unchanged. Forward migrations 013 and 014 reconcile the foundation
and enforce the access boundary. The conflicting schema.sql was moved to
supabase/archive/legacy-schema.sql.disabled; its Git-normalized contents are
unchanged. Never execute that archive or use browser state/seeds as a database.
The seed file contains comments only. Historical proposals assigning 013-015
to future booking/payment work are superseded; those numbers cannot be reused.

## Canonical tables

| Table | Stored contract / responsibility |
| --- | --- |
| admin_profiles | Unique auth.users user_id, owner/admin/viewer role, active status. No browser writes. |
| customers | Guest first_name, last_name, email, phone. V1 has no customer Auth linkage or signup. |
| service_zones | name, postcode_prefix, callout_fee_pence, active, priority. No invented coverage. |
| tyre_products | Product specifications, unique SKU/slug, tier budget/standard/premium. |
| inventory | Unique tyre_product_id, stock_qty, reserved_qty, cost_price_pence, selling_price_pence. Available stock is stock minus reserved. |
| availability_rules | Approved day, hours, duration, capacity. Public reads do not generate schedules. |
| blocked_dates | Unique date, reason, attributable created_by. |
| booking_slots | date, start_at, end_at, capacity; unique date/time triple. |
| slot_holds | slot_id, unique token, expires_at. A browser token is not a confirmed hold. |
| inventory_holds | slot_hold_id, tyre_product_id, quantity, expires_at; unique hold/product pair. |
| bookings | reference, UUID manage_token, customer/slot/fitter/zone links, registration, address, status, amounts in pence. |
| booking_items | Product link plus immutable SKU/brand/model/size/price snapshots. |
| payments | Provider receipt records; unique Stripe session/intent references, status/type/amount, optional succeeded_at evidence. |
| fitters | Real name/phone/van/active records; absent assignment remains unassigned. |
| business_settings | Singleton configuration. pricing_configured=false prevents the historical default deposit from becoming an approved quote. Fitting fee, duration and policy must be deliberately configured. |
| audit_logs | Actor, action, resource and metadata. Authorized stock/access mutations and their audits share one transaction. |
| rate_limits | Unique bucket_key, hits, window_start, expires_at. Atomic counter RPC serializes concurrent requests. |
| email_outbox | Deduplicated pending delivery, recipient/template/payload, retries, provider receipt and sent_at. Delivery worker remains unavailable. |
| webhook_events | Unique provider/event identity. Payment transitions remain unavailable. |
| vrm_cache | Hash and encrypted provider payload with expiry. No invented vehicle data. |
| interest_registrations | Explicit stored interest records; automatic lookup-failure capture remains disabled. |

## Auth, RLS and RBAC

Supabase Auth is reserved for provisioned owner/admin/viewer identities. The
application customer account endpoints return 404 and account screens return
to the finder. Disable public signup in the Supabase project itself; live
acceptance checks the provider setting. No route provisions or promotes a
public visitor. First-owner provisioning remains an explicit trusted operation.

RLS (row-level security) controls which rows a browser database client can
read. RBAC (role-based access control) controls which server action a signed-in
operator can perform. Browser clients have no INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES or schema CREATE rights. Owners also use protected server routes.
Only active provisioned operators with a live auth.sessions record can read
private tables. Normal users and inactive operators see no sensitive rows.
Anonymous product/zone projections remain public-safe and read-only.

| Identity | Server reads | Inventory stock/price change | Change existing operator access |
| --- | --- | --- | --- |
| Anonymous / normal / inactive | Denied | Denied | Denied |
| Viewer | Allowed | Denied | Denied |
| Admin | Allowed | Allowed | Denied |
| Owner | Allowed | Allowed | Allowed; last active owner cannot be removed |

The mutation path is browser -> protected Next.js route -> live session/current
role check -> privileged server client -> restricted SQL function -> transaction
containing change and audit. Each SQL mutation rechecks the supplied actor and
session. Caller-supplied actor/session fields are rejected by strict payload
validation. Cross-origin cookie mutations are denied.

Protected reads use has_live_session(), is_active_admin(uuid) and
admin_session_context(). Server-only mutations use admin_set_inventory(),
owner_set_admin_access() and consume_rate_limit(). These security-definer
functions have an empty search_path and explicit EXECUTE grants. Browser roles
cannot invoke privileged mutations. set_updated_at() drives eight update
triggers. No role claim in a cached JWT grants access on its own.

Supabase access JWTs can outlive sign-out. Checking auth.sessions on every
protected request and private-row policy rejects replay after logout/global
revocation. Current profile checks enforce deactivation and role changes.
Provider documentation: https://supabase.com/docs/guides/auth/signout and
https://supabase.com/docs/guides/auth/sessions.

## Runtime mappings and limits

Server projections map canonical stored fields to the existing UI response
names (for example reference -> booking_ref, date -> slot_date). These aliases
are response contracts, not alternate database schemas. Catalogue projections
omit costs and suppliers. Booking projections omit internal notes. A short
reference alone cannot reveal a booking; confirmation also requires its UUID
management capability. Database/validation failures remain unavailable states.

This gate does not enable a reservation, Checkout, signed payment transition,
refund, email worker, scheduling editor or booking editor. create_slot_hold is
not implemented in this chain: attempts fail closed, without a local insert or
fake reservation. Future commerce migrations must implement and test the
atomic engine against this schema. succeeded_at is nullable storage for future
verified receipts; no new payment success path is enabled here.

A live database on a legacy architecture needs a separately reviewed data
upgrade plan. This gate's reset runner targets only an explicitly authorized
disposable project, never a production database. Read 02_GATE0_ACCEPTANCE.md
for exact live evidence requirements and the current block.
