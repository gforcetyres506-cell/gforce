# Environment reference

No secret values are recorded. `.env.gate0.local`, `.env.local`, process credentials
and local Vercel/Supabase authentication were absent during this run. `.env.example`
contains blank fields. Keep real values ignored or in the provider secret store.

| Variable group | Purpose / required boundary |
| --- | --- |
| `APP_ENV=production`, `ENABLE_MOCK_DATA=false` | Production mode; mock mode is forbidden in a production build |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public project/client configuration; URL must be the intended environment; a public key is not privileged authorization |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged client; never bundle or log; every operation still needs API authorization |
| `APP_URL`, `NEXT_PUBLIC_SITE_URL` | Accepted HTTPS canonical production origin; use the isolated preview origin where acceptance scripts require it; public SEO canonical stays fixed to www |
| `BUSINESS_PHONE`, `BUSINESS_WHATSAPP` | Approved international numbers for public buttons; independent of DB settings; absent/invalid hides the action; redeploy after changes |
| `TYRE_IMAGE_HOSTS` | Exact approved image hostnames, comma separated; no protocols/wildcards |
| `RESEND_API_KEY`, `EMAIL_FROM` | Server-only sending and approved verified sender; actual recipient/inbox acceptance required |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Real bot-protection keys when the verified lookup flow is enabled; public test secrets never accepted in production |
| `ONEAUTO_API_KEY`, `VRM_CACHE_ENCRYPTION_KEY` | Optional future adapter only; a key alone does not enable lookup |
| `STRIPE_*`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Legacy compatibility only; not required for new V1 bank-transfer bookings |
| `PHASE1_*` | Disposable acceptance only; never production variables; see below |

Gate 0 requires `PHASE1_DISPOSABLE_PROJECT_REF`, `PHASE1_DATABASE_URL`,
`PHASE1_CONFIRM_DISPOSABLE=I_CONFIRM_THIS_PROJECT_IS_DISPOSABLE`, private random
`PHASE1_ACCEPTANCE_TOKEN`, `PHASE1_APP_URL`, unique `PHASE1_RESET_EVIDENCE_JSON` and
`PHASE1_EVIDENCE_JSON`; optional trusted `PHASE1_DATABASE_CA_FILE` for verified TLS.
All three Supabase variables must match the explicitly authorized project.
The literal confirmation does not replace human authorization of an actual ref.

With the ignored file present, Node's `--env-file=.env.gate0.local` loads it
without putting values in command arguments. Build/start with the intended
environment, then run the existing attestation/reset/acceptance procedures.
Never print the file, `env`, connection string or provider response containing
credentials. Separate staging and production values in Vercel; redeploy after
changes. Never commit backups, auth files, service credentials or manage links.
