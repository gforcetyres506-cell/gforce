# Phase 1 Report

> Gate 0 update (2026-10-10): current architecture, five-role acceptance and live status are in [production/02_GATE0_ACCEPTANCE.md](production/02_GATE0_ACCEPTANCE.md). This historical checklist does not certify cloud acceptance. Use the gated runner and exact authorized disposable target; no production reset is authorized.


Status: **LOCAL CODE FOUNDATION COMPLETE; LIVE ACCEPTANCE BLOCKED.**

The code foundation is implemented and the local build gate passes. Phase 1
must not be called production-ready until migrations, Auth and RLS are exercised
against a disposable/live Supabase project with the required identities.

## Database migrations

Twelve ordered files were added under `supabase/migrations/`:

1. extensions/shared trigger
2. admin profiles
3. customers
4. service zones
5. tyre catalogue and inventory
6. availability rules, slots and blocked dates
7. slot and inventory holds
8. bookings and snapshot items
9. payments and idempotent webhook events
10. fitters, settings, audit logs, encrypted VRM cache and interest registrations
11. RLS, grants and safe public read policies
12. expected query-path indexes

The V3 migration SQL declares all 19 required tables. Money is integer pence;
booking item prices are snapshots; webhook provider/event is unique; VRM cache
stores a lookup hash plus encrypted payload and expiry.

## Authentication and authorization

- `src/lib/supabase/client.ts`: browser-safe public client.
- `src/lib/supabase/server.ts`: cookie-aware SSR/route client.
- `src/lib/supabase/admin.ts`: `server-only` service-role client.
- `src/middleware.ts`: refreshes cookie-backed sessions without exposing protected content.
- `/api/admin/login`: Supabase password sign-in followed by active `admin_profiles` owner/admin check; errors do not enumerate accounts.
- `/admin/(protected)/layout.tsx`: server-side authorization before protected pages render; unauthorized authenticated users receive the Next.js 403 boundary.
- `requireAdmin()`: reusable independent guard used by both current admin mutation routes.
- `/api/admin/logout`: clears the Supabase session.
- `writeAuditLog()`: Zod-validated server-only audit infrastructure.

## RLS and service-role posture

- The RLS migration enables RLS on every required table; deployment has not yet been verified.
- The migration declares no anonymous grant/policy for customers, bookings,
  payments, webhook events, audit logs, internal settings, holds or VRM cache.
- It limits anonymous catalogue access to active product-safe columns and active
  service-zone-safe columns.
- It limits authenticated normal users to their own admin profile plus the same
  public-safe rows. It grants active admins read policies; mutations remain
  server/service-role operations after `requireAdmin()`.
- The service-role key appears only in server-only environment/client modules;
  a built browser JavaScript scan found no occurrence.

## Mock-data state

Demo data remains available only when a developer explicitly enables it outside
production. Admin operational tables render an explicit Phase 3 pending state
when mock mode is off. Real customer search is still Phase 2; real slots,
booking persistence, stock holds, Stripe and email remain Phase 3. No Phase 2 or
Phase 3 workflow is claimed complete.

## Security tests

- `npm run test:security`: PASS.
- Unauthenticated `GET /admin`: local HTTP `307` to `/admin/login`: PASS.
- `/admin/login`: local HTTP `200`: PASS.
- Unauthenticated admin slot mutation: local HTTP `401`: PASS.
- Production mock-mode configuration load: failed as required: PASS.
- Production startup with incomplete mandatory environment: failed as required: PASS.
- Wrong-password, normal-user, inactive-admin and active-owner scenarios: NOT RUN; require real Supabase test identities.
- Anonymous live queries against customers/payments: NOT RUN; RLS static structure passed but migrations are not deployed here.
- Fresh-database migration execution: NOT RUN; no authorized disposable Supabase/PostgreSQL target was provided.

## Performance comparison

| Route | Baseline first-load JS | Phase 1 | Change |
|---|---:|---:|---:|
| `/` | 119 kB | 119 kB | 0 kB |
| `/booking` | 124 kB | 124 kB | 0 kB |
| `/tyres` | 106 kB | 106 kB | 0 kB |
| `/admin/login` | 112 kB | 112 kB | 0 kB |
| `/admin/bookings` | 122 kB | 123 kB | +1 kB |
| Shared | 103 kB | 103 kB | 0 kB |

The final optimized compile completed in 22.5 seconds. Deferred 3D code and
visual behavior were not changed. No major measured bundle regression occurred.
Lighthouse and real-user CWV remain unmeasured.

## Build and code quality

- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run lint`: PASS with 0 errors and 46 warnings. Warnings are primarily
  pre-existing unused imports/`any` types plus two hook-dependency warnings and
  the existing Google-font loading warning; they remain technical debt and are
  not hidden.

## Files changed

- Environment/runtime: `.env.example`, `next.config.mjs`, `src/instrumentation.ts`, `src/middleware.ts`, `src/lib/env*`, `src/lib/mock-mode.ts`.
- Supabase/auth/security: `src/lib/supabase/`, `src/lib/auth/admin.ts`, `src/lib/audit.ts`, admin login/logout routes, protected admin route group and admin navigation.
- Data foundation: all `supabase/migrations/*.sql` files.
- Demo boundary: booking/payment/hold/search/catalogue/confirmation/manage/admin demo consumers and routes.
- Verification/handoff: ESLint config, `scripts/security-check.mjs`, README and all Phase 0–1 docs.

## Phase 1 acceptance blockers

1. Apply migrations to an authorized disposable Supabase project and prove a fresh migration run succeeds.
2. Create normal, inactive-admin and active-owner test users; execute all eight tests in `ADMIN_SECURITY_TESTS.md`.
3. Bootstrap the first real owner using `ADMIN_BOOTSTRAP.md` only after those tests pass.
Only after all three pass should the owner approve Phase 2: real customer
postcode/Turnstile/OneAuto/catalogue search. Phase 3 remains explicitly out of
scope.

## Separate launch blockers

- Resolve/remove public claims marked unsafe.
- Capture Lighthouse and real-device 3D measurements and implement the required weak-device fallback.
- Complete Phases 2 and 3; customer search, commerce and operational persistence are not live.

Command-level local evidence and missing external evidence are inventoried in
`VERIFICATION_EVIDENCE.md`.
