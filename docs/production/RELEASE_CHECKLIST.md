# Release acceptance checklist

Use current evidence, not historical PASS labels. Record accepted SHA/environment,
UTC time, operator and sanitized proof for every gate. Current readiness: NO.

- [x] Exact initial repository/branch/SHA and clean state verified; branch pushed.
- [x] Preview build succeeded for the initial SHA (protected; runtime unaccepted).
- [x] Manual-only finder implemented; unavailable registration promotion removed.
- [x] Local native backup/restore rehearsal passed; all 18 migrations included.
- [x] Nine owner/technical runbooks prepared.
- [ ] Authorized disposable app/ref/database target attested; reset/current-chain
      live Auth/RLS/RBAC/session/browser-role tests pass.
- [ ] Approved contacts, zones/fees, real products/prices/stock/SKUs, fitters,
      hours/slots/capacities, bank/window, VAT decision and policies loaded through
      supported audited workflows; public and admin contact values match.
- [ ] Hosted slot capacity 1 and stock 2/quantity 2 each pass 20-way races with
      1 success/19 conflicts; idempotency/expiry/rollback/invariants pass.
- [ ] Hosted payment verification, extension, cancellation, refund recording and
      admin operations/roles/audit pass. No fabricated money event.
- [ ] Resend sender/DNS approved; retry/failure/idempotency and actual inbox pass.
- [ ] Approved public legal pages published and accepted; unavailable copy removed.
- [ ] Exact-SHA preview SEO/CSP/private routes/secure cookies pass; staging access
      remains protected. Runtime audit zero high/critical; tooling risk reviewed.
- [ ] Seven widths, throttled interactions, Chromium/WebKit and available physical
      phones accepted. Field performance evidence distinguished from lab timings.
- [ ] Hosted backup/restore and rollback compatibility proven; production identity
      client-owned; RTO/RPO and incident operators approved.
- [ ] Private provider metrics/log redaction and alerts tested; public workflow
      activated only after production acceptance.
- [ ] Fresh hosted customer + admin E2E uses approved real data and persistence.
- [ ] P0=0/no unsafe P1; release merge → full suite → main merge → exact-SHA
      production deployment → read-only and controlled real booking acceptance.
- [ ] Owner demonstrates every workflow in CLIENT_ADMIN_GUIDE without developer help.
- [ ] Only after safe production: Search Console Domain property verified,
      sitemap submitted, six public URLs inspected/requested for indexing.

OneAuto is optional and disabled; it is not an open production blocker. Correct
HTTPS/canonical routing with a harmless HTTP-apex extra hop is acceptable. GBP
verification may remain administrative if the website itself operates safely.
