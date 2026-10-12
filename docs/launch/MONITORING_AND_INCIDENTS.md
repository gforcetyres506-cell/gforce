# Launch monitoring and incident ownership

Status: **PREPARED / ACTIVATION BLOCKED**. No scheduler, account, alert destination or production service was created or changed.

Before release the client must assign a named primary operator, backup operator, business/payment owner and hosting/database owner, plus a tested private alert destination. Roles below are required assignments, not invented people.

| Signal | Proposed initial alert | Responsible role | First response |
| --- | --- | --- | --- |
| Availability/TLS | Two failed public checks one minute apart, or certificate within 14 days of expiry | Hosting operator | Confirm from another network; inspect hosting/domain/certificate status; avoid unreviewed DNS changes |
| 5xx responses | >2% for 5 minutes with at least 20 requests, or three consecutive booking 5xx | Application operator | Check sanitized route/error-code counts and provider health; stop recommending bookings if persistence cannot be verified |
| Booking API failures | Three server failures in 5 minutes; ignore normal invalid-input/conflict responses | Application operator | Check database/connectivity and resource checks; never report a booking created without persisted proof |
| Bank workflow | Verification transaction failure or expired reservation with reported transfer | Business/payment owner | Independently inspect business bank receipt and recorded reservation; never mark paid based on a customer screenshot |
| Email outbox | Failed count >0, or processing older than 15 minutes | Application + email operator | Inspect authenticated admin aggregate/outbox state; reconcile provider idempotency before retry; accepted is not inbox delivery |
| Admin authentication | Sustained failure spike over baseline; valid owner unable to sign in | Access owner | Check Auth/provider state and revocations; never bypass RBAC or self-lockout controls |
| Web Vitals | Field 75th-percentile LCP >2.5s, INP >200ms or CLS >0.1 once sufficient samples exist | Frontend operator | Compare accepted source SHA, images, caching and provider timing; lab results alone do not prove field compliance |

Thresholds are proposed initial operating choices, not measured production baselines. Review after a week of real traffic. Monitor public home/robots/sitemap read-only; do not create real bookings or poll customer-token URLs for uptime checks. Financial/payment checks stay behind staff authorization and use existing aggregate admin data.

Incident sequence: acknowledge privately; record UTC and local time, deployment SHA and sanitized route/error code; establish scope; contact the assigned business owner; stop unsafe customer progression; use only an approved rollback; verify recovery independently; record cause and follow-up action. Restore rehearsals require a separately authorized disposable target. No production database reset is part of this work.

Never log request bodies, management URLs/tokens, customer names, addresses, registration plates, bank details, cookies, credentials or environment values. Configure Vercel/CDN/access logs and any external monitoring to redact dynamic `/manage/*`, `/api/manage/*` and confirmation query strings before accepting the release. Application code alone cannot attest platform log redaction. Do not add a public metrics endpoint exposing operational/customer data.
