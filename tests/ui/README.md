# Customer UI and truthful funnel guardrails

Run `npx playwright install chromium`, then `npm run test:ui`. The suite builds
and starts the production application on localhost:3100 and checks Chromium at
360, 375, 390, 430, 768, 1366 and 1440px. Port 3100 must be free; an existing
server is never reused.

The local server receives reserved fictional contact numbers only from the
Playwright configuration. Production has no fixture injection switch.
Database/provider credentials are explicitly empty. Browser API requests are
fulfilled with isolated test fixtures for layout and failure-path scenarios.
Server catalogue rendering must show inventory unavailable, with no products.
Direct APIRequestContext checks bypass browser routing and assert the actual
credential-free production server returns validation errors or 503/404 instead of fake success.

Coverage includes mobile overflow, WCAG axe checks, primary actions, contact
locations, hidden staff/account navigation, drawer keyboard behavior, 44px
critical targets, autofill, fonts, metadata, tier presentation and four booking
steps. Truth tests require empty manual size fields, explicit rear selection,
valid product context, truthful atomic checkout failure/retry, deadline refresh, real quote
amounts, pricing outages, unassigned fitter copy, unpaid progress and retired
payment behavior. No test creates a cloud booking, hold, payment or user.

To also verify hidden contact actions with configuration absent, use PowerShell:

```powershell
$env:UI_TEST_CONTACTS = 'off'
npm run test:ui -- --grep 'public pages'
Remove-Item Env:UI_TEST_CONTACTS
```

Each run builds its contact configuration. Prerendered pages read BUSINESS_PHONE
and BUSINESS_WHATSAPP during build; real configuration changes require redeploy.
WhatsApp never inherits a telephone number.

Run `npm run test:reliability` for isolated actual-TypeScript helper tests.
Database/provider doubles are confined to tests/reliability; unexpected network
access throws. They cover outage/empty/invalid database results, atomic hold
readback/expiry, exact persistent prices, duplicate-line stock checks, postcode
provider failure and OneAuto unavailable/unknown/ambiguous/timeout behavior.

Local checks do not establish hosted data correctness, provider delivery,
physical-device behavior or commerce release readiness. Reports, traces and
screenshots are ignored by Git.
