# Deployment and rollback

Production is gated. The initial authorized push was
`10720907fd4c67754ea3d0d65b8883563cbde2fb` on `release/seo-security-launch`.
GitHub recorded a successful protected Vercel Preview at
`https://gforce-11gmgumdj-g-force2.vercel.app`. The available Vercel account cannot
access that project. A provider build-success record is not hosted acceptance.

Before merging, require attested disposable Gate 0, migrations 001–018, hosted
20-contender stock/slot races, bank/admin/security/E2E, approved real facts/legal,
email inbox proof, hosted restore and monitoring. Require P0=0 and no unsafe P1.
OneAuto and a harmless HTTP-apex two-hop redirect are not blockers by themselves.

1. Verify repository, clean reviewed source, exact remote branch/SHA and CI.
2. Configure Preview with the authorized disposable Supabase project; prove app
   project = authorized disposable ref = database target before any reset.
   Use the existing reset/acceptance scripts in `02_GATE0_ACCEPTANCE.md`.
3. Verify exact-SHA staging SEO/CSP/flows using an authorized preview session or
   provider automation access. Preserve preview protection. Never mix production
   DB credentials into disposable reset settings.
4. Verify client-owned production project identity, migration ledger, backup and
   compatible forward migration plan. Apply forward migrations only. Import
   approved records through supported audited workflows. No destructive reset.
5. Merge `release/seo-security-launch → release/v1-production`, rerun the complete
   suite, then merge `release/v1-production → main` using the repository policy.
   Push normally, never force. Record the actual resulting main SHA.
6. Deploy exactly that main SHA as Vercel Production. Verify Git SHA/environment
   in the provider record and domain mapping. A timestamp or version label alone
   does not prove identity. Confirm runtime mock mode is disabled and acceptance
   tokens/flags are absent.
7. Run read-only public checks, then controlled real booking/admin acceptance.
   A person performs and verifies any actual bank transfer. Only then activate
   monitoring and proceed to the indexing checklist.

Rollback: identify a previously accepted deployment that is compatible with the
current database, then use Vercel Instant Rollback and reverify domain/SHA/flows.
It restores that deployment's build/configuration; changed environment variables
need a new deployment. Do not roll back to the currently unaccepted old site just
because it responds 200. Database migrations are forward-only; use reviewed
compensating migrations. A data restore needs separate incident approval and
payment/customer reconciliation. Preserve migration hashes and backup evidence.

Sources: [Vercel rollback](https://vercel.com/docs/instant-rollback),
[environment variables](https://vercel.com/docs/environment-variables).
