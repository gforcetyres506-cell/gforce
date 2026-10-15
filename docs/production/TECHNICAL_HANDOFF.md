# Technical handoff

Canonical repository: `https://github.com/gforcetyres506-cell/gforce.git`.
Next.js 15.5.27 App Router, React 19, TypeScript, Tailwind 3; Supabase Postgres/Auth;
Vercel deployment; Resend instruction email. V1 payments are manual bank transfers.
Stripe compatibility paths are retained for historical records, not new checkout.
OneAuto's account adapter is unverified and disabled. No live 3D is required.

Public indexable routes are `/`, `/mobile-tyre-fitting`, `/how-it-works`, `/coverage`,
`/contact`, `/guides/tyre-size`. Fixed canonical is
`https://www.gforcetyres-mobile.co.uk`. Private customer capability URLs and all
admin/API/checkout routes are noindex; capability routes have no social previews.
Do not log manage tokens or allow them into a sitemap, referrer or analytics event.

`supabase/migrations/001–018` in filename order are authoritative. The archived
legacy schema is not executable. Public projections exclude costs/internal notes.
Browser DB roles are read-only; server service-role operations require a verified
Auth user/session and live role checks. The service role bypasses RLS, so API
authorization is mandatory. Admin changes and audit commit atomically.

Booking checkout locks resources and uses integer-pence authoritative pricing,
temporary expiry-aware holds and an idempotency key. Verification converts holds
to operational allocations and confirms only the recorded full payment. Cancellation,
rescheduling, stock changes and refunds use protected audited transactions.
Email outbox leases/idempotency isolate provider failure from booking creation.
See Gate 2–4 documents for locking, retry and lease details.

Request-time CSP nonces require dynamic HTML. `middleware.ts` fixes canonical
redirects, headers and cross-site mutation denial. `getRequestOrigin` handles
trusted hosting forwarding without assuming Next's internal localhost origin.
Production source maps are disabled. Header, cookie and flow acceptance must be
repeated on the actual hosted build; local structure checks are insufficient.

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run test:security`, `npm run test:reliability`, `npm run test:database`,
`npm run test:concurrency`, `npm run test:bank-payments`, `npm run test:admin-os`,
`npm run test:ui`. On this Windows machine, a broken npm launcher can be bypassed
with `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run <script>`.
Native database suites require the ignored official PostgreSQL binaries described
in `04_GATE2_BOOKING_ENGINE.md`. They accept no cloud connection.

`ship-performance.mjs` targets loopback port 3111 only and uses isolated browser
fixtures. `gate2-local-postgres.mjs restore` rehearses native dump/restore after
Gate 4. Neither establishes hosted E2E. The current evidence/report is
[FINAL_AUTONOMOUS_SHIP_REPORT.md](FINAL_AUTONOMOUS_SHIP_REPORT.md); older reports
retain their original dates/scopes and are not fresh release acceptance.
