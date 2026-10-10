# Customer UI guardrails

Run `npx playwright install chromium`, then `npm run test:ui`. The suite builds
and starts the production application on localhost:3100 and checks Chromium at
360, 375, 390, 430, 768, 1366 and 1440px. Port 3100 must be free; an existing
server is never reused.

The local server receives reserved fictional contact numbers from the test
configuration. These numbers are test fixtures, never application defaults or
production business settings. The suite unsets database/provider credentials
and intercepts every browser `/api/` request, including slot reads and holds.
It stops before checkout. Server catalogue rendering uses the existing legacy
fallback because no database is configured; this is not a stock acceptance test.

To also verify hidden actions with contact settings absent, run in PowerShell:

```powershell
$env:UI_TEST_CONTACTS = 'off'
npm run test:ui -- --grep 'public pages'
Remove-Item Env:UI_TEST_CONTACTS
```

Both runs build their own contact configuration. Prerendered public pages read
`BUSINESS_PHONE` and `BUSINESS_WHATSAPP` during the build, so changing real
deployment configuration requires a redeploy. Leave both blank until the owner
supplies approved numbers. WhatsApp never inherits a telephone number.

Checks cover four booking steps, overflow, accessible primary actions, contact
locations, hidden staff/account navigation, mobile drawer keyboard behavior,
44px critical targets, autofill, fonts, metadata, styled tiers and axe WCAG AA
rules. Automated axe results do not certify full accessibility or production
booking/payment readiness. Reports, traces and screenshots are ignored by Git.
