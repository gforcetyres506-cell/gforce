# Admin Security Test Matrix

> Gate 0 update (2026-10-10): current architecture, five-role acceptance and live status are in [production/02_GATE0_ACCEPTANCE.md](production/02_GATE0_ACCEPTANCE.md). This historical checklist does not certify cloud acceptance. Use the gated runner and exact authorized disposable target; no production reset is authorized.


Automated structural checks run with `npm run test:security`. Live scenarios
require a migrated Supabase project and test identities; they must not be marked
passed from source inspection alone.

| # | Scenario | Expected | Current evidence | Status |
|---:|---|---|---|---|
| 1 | `GET /admin` with no session | Redirect to `/admin/login` | Local HTTP check returned `307` with `Location: /admin/login`; login returned `200` | PASSED locally |
| 2 | Wrong password | Generic denial | Local request with a deliberately invalid identity returned `401` without exposing an account | PASSED locally against configured Auth endpoint; repeat in disposable acceptance |
| 3 | Valid Auth user with no profile | Generic denial and sign-out | Login API requires matching `admin_profiles` row | IMPLEMENTED; live test pending |
| 4 | Profile with `active=false` | Denied | Login API and `requireAdmin()` both require `active=true` | IMPLEMENTED; live test pending |
| 5 | Active owner | `/admin` allowed | Role check accepts only `owner` or `admin` | IMPLEMENTED; live test pending |
| 6 | Anonymous browser query to `customers` | Denied | RLS enabled; no anon policy or grant | STATIC CHECK PASSED; deployed DB test pending |
| 7 | Anonymous browser query to `payments` | Denied | RLS enabled; no anon policy or grant | STATIC CHECK PASSED; deployed DB test pending |
| 8 | Browser JavaScript contains service-role key/name | Must not contain it | Service client imports `server-only`; built `.next/static` scan passes | PASSED locally |

Additional checks performed by the automated script:

- all 12 ordered migration files exist;
- all 19 required V3 tables exist in migrations and enable RLS;
- both current admin mutation routes independently call `requireAdmin()`;
- demo login strings and hardcoded credentials are absent;
- mock confirmation is explicitly gated;
- production mock mode fails configuration loading.

On 2026-08-23, an unauthenticated POST to `/api/admin/slots/update` also returned `401` during
the local HTTP check, confirming that hiding admin navigation is not the only
control.

## Required live test setup

Create three non-production Auth users: normal user, inactive admin, active owner.
Apply migrations to a disposable Supabase project, run all eight scenarios, and
record the redacted evidence below. Do not use production customer data.

## Disposable-project operator procedure

Executor: a developer or security operator authorized to use the disposable
project. The owner reviews the redacted result; they should not receive or share
the test passwords or secret keys.

### 1. Prepare and start

1. Use a dedicated disposable worktree/deployment where practical. If
   `.env.local` already exists, **do not copy over or overwrite it**. Back it up
   through the approved secure process and update only the required variables,
   or configure a separate hosted staging environment. Supply the disposable
   project's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   server-only `SUPABASE_SERVICE_ROLE_KEY`. Never commit a local environment file.
2. Apply migrations `001` through `012` in numeric order in Supabase SQL Editor.
3. Run `npm run test:security`. If this workstation's `npm` launcher is broken,
   run `node scripts/security-check.mjs`.
4. Start the app with `npm run dev`. The local fallback is:

```powershell
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000
```

5. Create the three disposable identities. Add `admin_profiles` rows only for
   inactive admin (`active=false`) and active owner (`active=true`), using the
   fail-closed UUID verification and insert in `ADMIN_BOOTSTRAP.md`.

### 2. Execute Auth and route cases

Run the anonymous and deliberately wrong-identity checks from PowerShell:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:3000/admin' -MaximumRedirection 0 -SkipHttpErrorCheck

$body = @{ email = 'nobody@example.invalid'; password = 'not-a-real-password' } | ConvertTo-Json
Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/admin/login' -Method Post -ContentType 'application/json' -Body $body -SkipHttpErrorCheck

Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/admin/slots/update' -Method Post -ContentType 'application/json' -Body '{"action":"toggle_active","slotId":"acceptance-test"}' -SkipHttpErrorCheck
```

Expected: `/admin` returns `307` with `Location: /admin/login`; the wrong login
and anonymous mutation return generic `401` responses with no account details.

Then use a clean browser profile for each identity:

- Normal user: submit valid Auth credentials at `/admin/login`; expect a generic
  denial, then confirm `/admin` still redirects to login.
- Inactive admin: repeat; expect the same generic denial and redirect.
- Active owner: sign in; expect `/admin` to redirect to `/admin/bookings`, open
  each protected admin page, then sign out and confirm `/admin` is blocked.

Record only status codes, redirect paths, visible generic messages, test time and
the final four characters of test UUIDs. Never record passwords, tokens or full
cookies.

### 3. Execute anonymous RLS cases

In a fresh PowerShell session, load the disposable project's public URL and anon
key into session-only environment variables from the authorized secret store.
Do not paste their values into this file. Then run:

```powershell
$anonHeaders = @{
  apikey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
  Authorization = "Bearer $($env:NEXT_PUBLIC_SUPABASE_ANON_KEY)"
}

Invoke-WebRequest -Uri "$($env:NEXT_PUBLIC_SUPABASE_URL)/rest/v1/customers?select=id&limit=1" -Headers $anonHeaders -SkipHttpErrorCheck
Invoke-WebRequest -Uri "$($env:NEXT_PUBLIC_SUPABASE_URL)/rest/v1/payments?select=id&limit=1" -Headers $anonHeaders -SkipHttpErrorCheck
```

Expected: both are denied with a non-`2xx` permission response. A `200` result,
even an empty array, fails acceptance and must be investigated before continuing.

### 4. Execute bundle and session controls

1. Run a production build with `npm run build`, or use
   `node node_modules/next/dist/bin/next build` on this workstation.
2. Run `npm run test:security`/the direct script again and retain its pass output.
3. With the active owner signed in, use the authorized Supabase admin control to
   revoke that test user's sessions. Refresh `/admin`; it must redirect to login
   and protected API requests must return `401`.
4. In browser developer tools, record the auth cookie names and security
   attributes without recording their values. Security review must explicitly
   accept or reject the observed `Secure`, `SameSite`, expiry and domain/path
   settings for the deployment.
5. Exercise the staged password-recovery flow and record whether the link lands
   only on the approved staging origin. Record the chosen MFA policy and the
   configured Auth/login rate-limit response. These items remain failed until an
   authorized reviewer signs them.

### Disposable-project acceptance record

- Test date/time (UTC): `NOT RUN`
- Tester/operator: `NOT ASSIGNED`
- Supabase project reference (redacted if required): `NOT RECORDED`
- Application environment/URL: `NOT RECORDED`
- Migration result for files 001-012: `NOT RUN`
- Normal-user Auth UUID suffix only: `NOT RECORDED`
- Inactive-admin Auth UUID suffix only: `NOT RECORDED`
- Active-owner Auth UUID suffix only: `NOT RECORDED`
- Scenario results 1-8 with redacted response/query evidence: `NOT RUN`
- MFA/recovery/rate-limit/session-revocation decision: `NOT RECORDED`
- Final result: `FAIL UNTIL EVERY REQUIRED FIELD PASSES`
- Security operator sign-off: `NOT SIGNED`
- Owner acceptance: `NOT SIGNED`

Do not record passwords, tokens, complete UUIDs or service-role keys in this file.

The current local evidence record is `VERIFICATION_EVIDENCE.md`. Supabase project
reference, test-user IDs and live RLS response evidence are explicitly absent.
