# G Force Tyres Mobile search, security and trust acceptance

Historical local hardening snapshot. The later autonomous ship request explicitly
authorizes branch pushes/PR preparation and makes OneAuto optional for V1. Use
`../production/FINAL_AUTONOMOUS_SHIP_REPORT.md` for the current decisions and blocker
counts. The register below retains the earlier snapshot rather than claiming new
hosted acceptance. OneAuto and a correct two-hop HTTP-apex redirect do not block V1.

Date: **12 October 2026 (Asia/Dhaka)**. Decision: **INDEXING READY: NO. PRODUCTION READY: NO.**

Repository: `https://github.com/gforcetyres506-cell/gforce`.
Branch: `release/seo-security-launch`.
Starting branch: `release/v1-production`.
Starting SHA: `5ab984d050fed5c68fbb0f8eed5d04b2d37461cf`.
Final commit SHA: recorded in the completion message; `git rev-parse HEAD` identifies this review snapshot.

The starting tree was clean. Work is confined to `gforce-production-recovery`; the neighbouring prototype checkout and its uncommitted work were left alone. Existing 18 migrations, booking transactions, bank verification, RBAC and owner self-lockout semantics are preserved. No remote push, merge, deployment, DNS modification, hosted migration, account creation or indexing submission occurred.

## Acceptance boundaries

The **branch** and the **existing live deployment** are separate evidence scopes. Public network checks do not attest a deployed source SHA. A local pass is never promoted to hosted acceptance.

| Item | Branch/local result | Existing live result / release boundary |
| --- | --- | --- |
| HTTPS | PASS public transport checks | PASS four variants reach HTTPS www; no HTTPS downgrade or loop observed |
| SSL | PASS Node, Windows curl and OpenSSL trust | PASS hostname/chain/current validity for both hosts; Chromium opens without ignoring certificate errors |
| Redirects | PASS application apex permanent redirect | FAIL preferred single-hop model: HTTP apex takes two 308 hops; final canonical destination is correct |
| Security headers | PASS local response/CSP/proxy checks | FAIL required set on existing live deployment: observed HSTS only, required CSP/frame/nosniff/referrer/capability policies absent |
| Secrets | PASS bounded source/browser/release scan: zero findings | BLOCKED remote environment/platform-log attestation; no production secret values were available to scan |
| Robots | PASS local 200 and directives | FAIL existing live `/robots.txt` returns 404 |
| Sitemap | PASS local XML/allowlist | FAIL existing live `/sitemap.xml` returns 404 |
| Canonical | PASS local rendered HTML | FAIL existing live homepage has no canonical |
| Metadata | PASS local unique metadata | FAIL existing live pages repeat the site title and lack the branch's page metadata |
| Structured data | PASS local parsing and factual assertions | BLOCKED exact branch deployment and external validator acceptance |
| Mobile | PASS automated seven-width functional/accessibility checks | Automated live Chromium 390px has no overflow; physical Safari/Chrome/Instagram acceptance BLOCKED |
| Core Web Vitals | BLOCKED field acceptance | No accepted deployment or sufficient field sample; targets are LCP <=2.5s, INP <=200ms, CLS <=0.1 |
| Local SEO foundation | BLOCKED business readiness | Templates implemented; real phone, zones, approved entity facts and profile verification still required |
| GEO foundation | PASS semantic/code foundation | BLOCKED hosted acceptance and actual search/answer-engine discovery; no ranking/citation promise |
| Google Search Console | HUMAN ACTION REQUIRED | No property/token/account verification or indexing request performed |
| Google Business Profile | HUMAN ACTION REQUIRED | Owner facts/eligibility/verification required; no profile created |
| Legal | BLOCKED | No owner/legal approval; public branch shows unavailable policies instead of unapproved legal terms |
| Live booking | BLOCKED | Hosted schema/Auth/RLS/RBAC/provider/races and controlled customer booking not accepted |
| Production data | BLOCKED | No approved real contact, catalogue, prices, coverage, fitters or bank settings supplied to this checkout |
| Indexing ready | **NO** | Mandatory live and business gates remain open |
| Production ready | **NO** | Human review and existing recovery gates remain mandatory |

## What changed

- Six indexable public pages have absolute canonical URLs, unique UK-English metadata, OpenGraph/Twitter information, useful navigation and factual content. Filters/catalogue, booking, payment, admin, API, accounts, confirmation and customer-management routes stay out of the sitemap. Utility pages are noindex; management paths are absent from public robots patterns and social/canonical URLs.
- Business identity is centralized. Empty owner facts stay empty. Organization, Service and BreadcrumbList JSON-LD use known facts only; output escapes script delimiters. No LocalBusiness address, fake review, Product/Offer, FAQPage or mass location-page generator was added.
- Production scripts use per-response cryptographic nonces with no unsafe-eval or inline-script exemption. Next/React hydration and Turnstile are covered; styles retain unsafe-inline for React sizing/widget compatibility. Supabase connections are restricted to the configured HTTPS origin; Resend is server-side. No Vercel analytics/insights integration exists, so no unnecessary browser service domain was permitted.
- Nonce HTML renders per request; this intentionally trades static HTML/CDN caching for a stronger script policy. Fonts remain Next-managed/self-hosted to browsers, with Google retrieval at build time. Product images use the same-origin optimiser with explicit approved supplier hosts; no wildcard remote source.
- Browser capabilities, framing, MIME sniffing and referrers are restricted. Token/confirmation pages use no-referrer and private no-store. HSTS is configured for secure canonical production requests, with includeSubDomains and without preload; validate real subdomains and deployed edge behavior before acceptance.
- Public-host decisions use the incoming Host rather than Next's possible internal loopback URL. Redirect paths are assigned separately to the fixed canonical origin so a path beginning with `//` cannot select another host. Same-origin mutations remain allowed behind the proxy; cross-site mutations fail closed.
- Session cookies are HttpOnly, SameSite=Lax and Secure in production. Existing auth still validates user, live session, active admin profile and permission before privileged operations. Cross-site API mutations are denied; Stripe webhook signature handling remains the exception. Public filters/dates/tokens are validated, and customer errors stay generic.
- Removed unapproved Greater London claims, self-certified GDPR language, public legal draft/preview text and unsupported registration-lookup promotion. Corrected retired account redirects to the real finder. Legacy email copy no longer promises a refund window, London coverage or unsupported aftercare timing; logs no longer include provider errors/customer-specific subjects there.
- Runtime dependency advisories were remediated with compatible patches. Full-install development findings remain explicitly unresolved; see `DEPENDENCY_REVIEW.md`.

## Public HTTPS and Instagram evidence

`evidence/LIVE_NETWORK.json` records both trusted TLS 1.3 chains. Each leaf is valid from **12 October 2026 00:08:15 UTC** through **10 January 2027 00:08:14 UTC**. Windows curl validated trust; OpenSSL with hostname verification and the installed CA bundle returned `Verify return code: 0 (ok)` for both names. Node independently verified the chain. Chromium used `ignoreHTTPSErrors: false` and returned 200 with no failed or HTTP resource requests on the homepage; see `evidence/LIVE_BROWSER.json` and its screenshot.

These checks provide no evidence that G Force's current direct HTTPS certificate is broken. The reported warning screenshot was described as showing `l.instagram.com`; the actual screenshot/link/time and physical in-app session were unavailable in this task. **Instagram warning cause: NOT VERIFIED.** Do not blame either certificate or wrapper without reproducing the exact shared link in Instagram and then directly in Safari/Chrome. Do not change GoDaddy DNS from that screenshot alone.

Live HTML audit found zero HTTP resource attributes and zero localhost links on the examined pages. This is a bounded check, not proof about every asset/page/device. The existing deployment still serves legal draft/preview wording and a self-certified GDPR claim on privacy; the branch corrections are not deployed.

The live homepage has `Access-Control-Allow-Origin: *` on its static response. This alone does not demonstrate wildcard **mutation** access. The branch does not add wildcard CORS and independently denies cross-origin mutations; hosted API behavior remains an acceptance requirement.

## Verification and unresolved gates

Final local check counts and statuses are recorded in `evidence/QUALITY.json`. Secret-scan findings and exact scope are in `evidence/SECRET_SCAN.json`; available private environment values are checked without printing them. Zero available private values is not a remote-secret audit. Source maps are disabled for production browsers. The release-history scan covers changes from the task baseline, not every historical commit or provider account.

Typecheck, lint (zero errors, three existing unused-3D warnings), production build and structural security checks passed. Reliability: **129/129**. The complete browser regression passed **252/252** across 360, 375, 390, 430, 768, 1366 and 1440 pixels. After the final shared proxy-origin fix, reliability, a fresh production build, **7/7** API browser checks and the proxy integration check passed. The full UI run precedes that final origin-helper change; this distinction is recorded in the quality evidence.

The initial browser failures exposed an obsolete assertion expecting 503 for malformed management tokens; 404 is the validated pre-database result. A later locator timeout was a test race during hydration: the visible action list changed between indexed measurements. Dimensions are now measured as one snapshot without weakening the 44px touch-target requirement. The subsequent complete run passed.

`evidence/LOCAL_BROWSER.json` is a **functional/proxy** pass, not performance acceptance. Its single simulated 390px sample used 150ms latency, 1.6Mbps download, 750Kbps upload and 4x CPU slowdown. LCP was **2.488s** and the layout-shift sum **0.04624**; observed event durations reached **696ms**. The LCP margin is small, and the interaction timing needs investigation under P1-07. This short synthetic sequence is not field INP or a field CLS measurement. **Core Web Vitals remain BLOCKED.** Viewport screenshots retain actual visible content; full-page Chromium captures can omit offscreen `content-visibility:auto` paint. No rendering styles were disabled to produce the captures.

Database regressions replayed all 18 migrations: security 16/16, native booking 12/12, bank payments 17/17 and admin operating system 3/3. Slot and inventory races each used 20 independent simultaneous contenders and produced exactly one winner and 19 conflicts. Hosted regression evidence is still absent. The first sandbox attempt was blocked by loopback/network restrictions; successful reruns used the authorized expanded environment. Production was never used as a test database.

Sanitized local PostgreSQL evidence is retained in `evidence/LOCAL_BOOKING_POSTGRES.json`, `LOCAL_BANK_POSTGRES.json` and `LOCAL_ADMIN_POSTGRES.json`. These identify loopback-only targets and migration hashes; they contain no connection passwords or customer records.

Google Rich Results Test and Schema.org hosted validators were not run against a deployment of this branch. Local JSON parsing/content assertions do not establish rich-result eligibility. Search Console/GBP/Bing/Apple account checks, physical devices, real email inbox delivery, provider secrets, production log redaction, backups/restore and monitoring activation remain BLOCKED / HUMAN ACTION REQUIRED.

## Open blocker register

| ID | Priority | Required resolution |
| --- | --- | --- |
| P0-01 | P0 | Explicitly authorize/configure the disposable Supabase target and pass the existing live Gate 0 identity/schema/Auth/RLS/RBAC/session acceptance |
| P1-01 | P1 | Supply and approve actual contact, coverage, catalogue/prices, fitters and bank settings; test real contact routes |
| P1-02 | P1 | Existing OneAuto gate remains disabled pending current account documentation/sandbox acceptance; manual entry remains the available path |
| P1-03 | P1 | Pass hosted slot/stock races, reservation/payment verification and controlled booking acceptance |
| P1-04 | P1 | Verify Resend domain/sender/content, outbox recovery and actual inbox delivery |
| P1-05 | P1 | Approve and publish real privacy/terms/cancellation/refund policy and consent decisions |
| P1-06 | P1 | Accept exact branch deployment and live robots/sitemap/canonical/metadata/schema/security headers; review HTTP apex's extra redirect hop |
| P1-07 | P1 | Accept physical devices, Safari/Chrome/Instagram behavior, slow-network experience and field performance |
| P1-08 | P1 | Assign/test monitoring alerts and incident ownership; attest hosting log redaction for customer-token URLs |
| P1-09 | P1 | Evidence hosted backup, authorized restore rehearsal and rollback |
| P1-10 | P1 | Verify client account ownership, owner training and operational acceptance |
| P1-11 | P1 | Resolve or explicitly accept the documented development-tool vulnerability risk after compatibility review |

**P0 OPEN: 1. P1 OPEN: 11.** This register carries forward the existing recovery gates and groups this task's hosted search/routing defects into deployment acceptance; it does not count every missing header as a separate blocker. OneAuto remains optional to the manual-only search journey but its prior acceptance gate has not been silently closed.

## Human handoff

Review this branch and evidence first. Supply owner facts and legal approval, then separately authorize the established disposable acceptance work and a deployment after review. Follow `INDEXING_RELEASE_CHECKLIST.md`; do not request indexing while its mandatory gates remain open. See the Search Console, Business Profile, content-plan, other-discovery and monitoring documents in this directory. No external account action was performed.
