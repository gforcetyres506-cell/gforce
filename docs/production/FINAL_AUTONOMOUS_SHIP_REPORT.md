# Final autonomous production ship report

12 October 2026. **PRODUCTION READY: NO. INDEXING READY: NO. SHIPPED: NO.**
This report supersedes earlier local-only readiness/blocker counts.

Production URL: `https://www.gforcetyres-mobile.co.uk` (existing old deployment).
Production SHA: **UNKNOWN / not attested**. Remote main:
`61346440dd64e5dacff31d6e6409236d08d3e6c8` at the current verification.
Last application-source change: `7a44b6daa9e98470557ab182ac033839e4ec91e0`.
Later commits add tested tooling, evidence and handoff documents; the application
tree remains identical. The final pushed branch SHA is returned in the handoff.
Draft [PR #1](https://github.com/gforcetyres506-cell/gforce/pull/1) targets
`release/v1-production`; no release/main merge or production deployment occurred.

## Current boundary

The correct initial clean branch/SHA was verified and pushed. The existing
reviewed `release/v1-production` baseline was published as the draft PR target.
Vercel built the earlier manual-finder source candidate `feec554` as a Preview:
`https://gforce-1wy8pad70-g-force2.vercel.app`. Its visible access page requires
team-owner approval. No preview protection was removed, and no private provider
environment was read. The GitHub connector could not create a PR; the existing
authorized Git push identity created the draft successfully without exposing
its credentials. These are completed branch/provider actions, not hosted acceptance.

Required Gate 0 credentials/authorization, owner data and legal copy remain absent.
No database reset, cloud migration, production business mutation, real money
event, external email, DNS change or indexing submission was performed. All
available safe local/read-only work is complete. The remaining hosted/provider,
owner-data/legal and physical-device steps require the grouped inputs below.

## Acceptance matrix

Statuses below describe **production/hosted acceptance**. Local results are kept
in a separate column; they cannot upgrade a blocked hosted gate.

| Area | Production status | Available evidence / missing input |
| --- | --- | --- |
| Supabase | BLOCKED | No authorized project configuration or three-way identity attestation |
| Database migrations | BLOCKED | All 18 pass locally; hosted ledger/reset/replay unverified |
| Auth/RLS/RBAC | BLOCKED | Local security/role tests pass; live Auth/session acceptance absent |
| Booking | BLOCKED | Local transactions pass; approved data and fresh hosted E2E absent |
| Concurrency | BLOCKED | Local 20-way slot/stock races pass 1 winner/19 conflicts; hosted absent |
| Bank payment | BLOCKED | Local receipt/expiry/rollback tests pass; approved bank configuration and actual bank event absent |
| Admin OS | BLOCKED | Local 3-case audited owner journey passes; hosted staff/owner training absent |
| Email | BLOCKED | Outbox tests pass locally; sender credentials/DNS and actual authorized inbox absent |
| Security | BLOCKED | Local headers/CSP/cookie guards/secret scan pass; exact hosted critical flows, sessions and platform log redaction absent |
| Dependencies | PASS runtime criterion | Zero runtime advisories; full-install 7 high/2 moderate development findings remain documented, not cleared |
| Performance | BLOCKED | Seven-width lab investigation; throttled samples exceed 200ms; no accepted hosted/field p75 evidence |
| Mobile | BLOCKED | Automated regression recorded separately; physical Safari/Chrome/Instagram session unavailable |
| SSL | PASS public domain | Trusted direct HTTPS for apex/www; no evidence supporting a DNS/certificate change; Instagram wrapper unverified |
| SEO / GEO | BLOCKED | Honest six-page/canonical/schema foundation locally; real facts and accepted hosted build absent |
| Robots / Sitemap | BLOCKED | Current production both 404; local branch versions pass |
| Search Console | HUMAN ACTION REQUIRED | Verified client Domain property/token/account absent; no indexing before readiness |
| Google Business Profile | HUMAN ACTION REQUIRED | Approved service-area facts and owner verification absent |
| Legal | HUMAN ACTION REQUIRED | Approved privacy/terms/cancellation/refund copy absent |
| Backup / Restore | BLOCKED | Native local 24-table/85-row restore exact; hosted backup/retention/restore absent |
| Monitoring | BLOCKED | Redacted public health script/workflow prepared; activation/private signals/alert owner and delivery absent |
| Owner handoff | BLOCKED | Nine guides completed; account ownership and hands-on hosted demonstration absent |

## Evidence and performance investigation

Evidence files live in `../launch/evidence/SHIP_*.json`. Raw local logs, database
archives and scratch directories remain ignored under `.local-postgres`.
Local fixtures never enter a hosted environment or substitute for business records.

Reliability **129/129**, database security **16/16**, native booking **12/12**,
bank **17/17**, and admin/restore journey **3/3** pass. The full two-browser run
passed **496/504**; eight test-harness failures were repaired. The affected checks
then passed **28/28** across both browsers/all widths. All **504 distinct cases**
have passing evidence across those runs; this is not claimed as one clean full
504-case run. `SHIP_UI_CASES.json` maps every case and retest. WebKit exercises
the truthful copy-denied fallback because Chromium's clipboard permission
override is unsupported there. Touch-target visibility and size are measured
atomically; the 44px minimum is preserved.
TypeScript/build checks are included in the fresh Playwright production build;
lint has zero errors and three pre-existing unused 3D warnings.

The old 696ms duration-only sample cannot identify its exact event/root cause.
The new observer records interaction IDs, input delay, handler time, presentation
delay and long animation frames. Controlled keyboard/navigation/quantity/booking
step sequences reproduce slower-than-target interactions under CPU 4x/network
throttling. Cold React event/hydration work and presentation time both contribute;
there is no evidence of a single blocking fetch or one guaranteed 696ms defect.
CSS effect removal in a temporary diagnostic did not establish a consistent gain,
so production CSS was preserved. Diagnostic captures are not acceptance evidence.

The unavailable OneAuto path was removed from the finder, including its validation
and challenge imports; an accepted postcode now enters manual sizes directly.
Initial homepage JavaScript decreased from **141kB to 116kB** (about 18%).
A readiness guard prevents actions before React attaches handlers. WebKit's
initial missing-style/interaction failures were traced to CSP upgrading local
HTTP assets to unavailable HTTPS, not a broken public certificate. The exception
now applies only to HTTP loopback; deployed HTTPS upgrade and strict scripts remain
enabled. `SHIP_PROXY_POLICY.json` verifies both real middleware responses. Neither
change claims field INP compliance.
Final unchanged-style lab measurements and cross-browser totals remain separate
from physical-device/hosted acceptance. No synthetic event result is called field INP.

Final three throttled 390px samples: homepage LCP **2.376s / 2.628s / 2.260s**;
worst qualifying interaction **296ms / 368ms / 288ms**; maximum layout-shift sum
across measured routes **0.04778**. Manual keyboard controls reached 200ms;
finder input and booking transitions still exceeded target in some runs. Other
unthrottled widths had interaction maxima of 112ms or less. The 696ms observation
did not recur, but differences in method/load prevent claiming a measured latency
improvement from that old sample. Performance acceptance remains BLOCKED.
Metric interpretation: [Google INP guidance](https://web.dev/articles/inp).

Local recovery proof covers the native database/schema, including Auth stand-ins;
it cannot verify Supabase Auth services, Storage files or provider recovery. Owner
RTO/RPO and actual hosted restore time are UNKNOWN. Prepared monitoring is opted
out by default; a script run against current production truthfully fails the
missing pages/canonical/security-header expectations.

## Open release blockers

| ID | Priority | Resolution |
| --- | --- | --- |
| P0-01 | P0 | Authorized disposable app/ref/database identity plus live migrations/Auth/RLS/RBAC/session acceptance |
| P1-01 | P1 | Approved real contacts, areas/fees, catalogue/prices/stock/SKUs, fitters, hours/capacity, bank/window, VAT and policies |
| P1-02 | P1 | Hosted booking races/payment/admin/fresh E2E and controlled real booking/payment acceptance |
| P1-03 | P1 | Resend sender/domain/outbox recovery and actual inbox delivery |
| P1-04 | P1 | Owner/legal-approved public policy publication |
| P1-05 | P1 | Authorized exact-SHA preview access and production target/deployment/SEO/security acceptance |
| P1-06 | P1 | Slow-interaction/hosted/physical-device acceptance; real Instagram reproduction where available |
| P1-07 | P1 | Provider log redaction, private operational alerts and named tested incident ownership |
| P1-08 | P1 | Hosted backup/retention and authorized restore rehearsal/rollback compatibility |
| P1-09 | P1 | Client account/recovery ownership and owner operational demonstration |

**P0 OPEN: 1. P1 OPEN: 9.** Development-only glob/parser advisories are a separately
reviewed P2 tooling risk for trusted build/lint inputs, not a cleared audit. They
do not violate the zero runtime high/critical criterion. See
`../launch/DEPENDENCY_REVIEW.md`; do not expose build/watch/lint to untrusted inputs.
OneAuto is optional and disabled; it is removed from the production blocker count.
The correct two-hop HTTP-apex redirect is not a blocker. GBP/Search Console
verification remains administrative and cannot close unsafe software gates.

## Human actions required

1. Provide the ignored secure Gate 0 configuration and explicitly authorized
   disposable project ref; provide separate proven client-owned production
   identity. Grant the existing authorized operator access to the actual G Force
   Vercel/Supabase project. Do not paste secrets in chat.
2. Supply approved real business/catalogue/stock/service/fitter/schedule/VAT data
   and privately configure bank details/payment window; provide approved public
   privacy/terms/cancellation/refund copy. Use audited admin/import workflows.
3. Provide approved Resend sender/domain access and an authorized test mailbox;
   confirm actual inbox receipt. Assign primary/backup incident operators, a
   private tested alert destination and backup/RTO/RPO ownership.
4. Make physical phone/Safari/Chrome/Instagram acceptance available, then perform
   the controlled real bank transfer/receipt or refund event when staging and
   production are safe. Never mark paid/refunded before actual money movement.
5. After production acceptance, verify Search Console **Domain property**
   `gforcetyres-mobile.co.uk`: GoDaddy **TXT, host @**, exact Google-issued value
   (currently UNKNOWN); preserve existing DNS. Submit
   `https://www.gforcetyres-mobile.co.uk/sitemap.xml`, inspect/request indexing for
   `/`, `/mobile-tyre-fitting`, `/how-it-works`, `/coverage`, `/contact`,
   `/guides/tyre-size`. Complete GBP owner verification with actual service areas
   and no private residential address, and demonstrate the owner guide workflows.
