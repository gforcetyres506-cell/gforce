# G Force Tyres — Mobile Tyre Fitting Platform

Next.js 15 application with one canonical ordered Supabase migration chain
(001-014), SSR operator Auth, live-session checks and read-only browser RLS.
Customer accounts are disabled for V1. Catalogue and quotes require real,
configured database records; reservation/payment/email workflows remain unavailable.

Gate 0 is verified locally, with cloud acceptance BLOCKED pending an explicitly
authorized disposable project. Local checks: production build, typecheck,
security structure, 58 reliability/boundary tests, 12 PostgreSQL tests and
119 responsive UI tests pass. Lint has 0 errors and 4 existing warnings.

Read [Gate 0 evidence and acceptance procedure](docs/production/02_GATE0_ACCEPTANCE.md)
and [canonical architecture](docs/production/01_CANONICAL_ARCHITECTURE.md).
No production reset, deployment or launch readiness is certified.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill it in — see below
npm run dev                    # http://localhost:3000
```

The site boots without a real catalogue. The V3 migrations create the structure
only; approved production catalogue data has not been supplied or imported.

---

## 1. Supabase

Create a project at supabase.com (free tier is enough), then:

1. Apply the ordered files in `supabase/migrations/` to a disposable Supabase project.
2. Run every live scenario in `docs/ADMIN_SECURITY_TESTS.md` with test identities.
3. Only after those tests pass, follow `docs/ADMIN_BOOTSTRAP.md` to create the
   real owner account.

Do not run the legacy `supabase/seed.sql` against the V3 schema. It targets the
old mutable schema and exists only as historical demo material.

Then **Settings → API** and copy into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
```

> The service key bypasses Row Level Security completely. It belongs in
> `.env.local` and your host's environment variables — never in a component,
> never in git.

## 2. Stripe

Stripe Checkout, verified webhook persistence, slot/stock holds and booking
transactions are reserved for Phase 3. Do not collect card data through the
legacy mock form or configure a public commerce launch from the current code.

---

## 3. Production integrations

Development can run without live integrations. Production startup intentionally
requires the complete `.env.example` contract; no integration silently falls
back to fictional data.

| Variable | Without it |
|---|---|
| `ONEAUTO_API_KEY` | Phase 2 vehicle search remains unavailable. |
| `RESEND_API_KEY` | Phase 3 email remains unavailable. |
| `TURNSTILE_SECRET_KEY` | Bot check is skipped in dev. **In production the code refuses requests when this is missing** — that is deliberate. |

---

## Target architecture (Phase 2–3, not current completion)

```
Browser ──► Next.js API routes ──► Supabase (service key, bypasses RLS)
                    │
                    ├──► Stripe        (deposit PaymentIntent)
                    ├──► OneAutoAPI    (VRM → OEM tyre size, encrypted cache <=24h)
                    ├──► Postcodes.io  (postcode validation, free)
                    └──► Resend        (transactional email)
```

The V3 RLS migration is written to grant anonymous access only to active,
product-safe catalogue columns and active, safe service-zone columns. It is
written to deny anonymous access to customers, payments, bookings, webhook
events, audit logs and internal settings. This posture is not confirmed until
the migrations and live role tests pass against an authorized Supabase project.
All future mutations must go through authenticated server routes.

### Money

Every monetary value in the codebase is an **integer number of pence**.
£149.00 is `14900`. There are no floats anywhere in the money path.
`formatPrice()` in `lib/utils.ts` is the only place money becomes a string.

### Phase 3 payment invariants

These are requirements, not claims about the current implementation:

- the browser must send product IDs and quantities, never an authoritative price;
- server code must recalculate every amount from persistent catalogue data;
- only a signature-verified, idempotently processed Stripe webhook may confirm
  a paid booking; and
- a browser success redirect must never be treated as proof of payment.

### Slot locking

The V3 migrations declare the data needed for slot and inventory holds, but
the atomic hold transaction is not implemented or live-tested yet. Phase 3
must use a PostgreSQL transaction with row locking so two customers cannot
reserve the last capacity or stock simultaneously. The intended hold window is
15 minutes and still requires owner confirmation.

---

## Hosting preparation

### Vercel (simplest)

After the Phase 1 live acceptance checks and the later booking/payment phases
pass, push to GitHub, import at Vercel and configure every production variable.
The current build must not be opened to customers.

### Cloudflare Workers (£0 fixed cost)

```bash
npm run pages:build
npm run pages:deploy
```

This is a future hosting path. Validate framework compatibility and set every
production variable before using it.

During Phase 3 payment implementation, configure the Stripe webhook endpoint at
your live URL to subscribe to:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

---

## Before you go live

This codebase compiles and builds. It has not been run against real
services. Work through this list before a paying customer sees it.

### Phase 3 money paths — non-negotiable

- [ ] Complete a test booking end to end with card `4242 4242 4242 4242`
- [ ] Confirm the booking flips `pending_payment` → `confirmed` in Supabase
- [ ] Confirm tyre `stock` decremented by the right quantity
- [ ] Fire the same webhook event twice (`stripe events resend <id>`) and
      confirm stock does **not** decrement twice
- [ ] Tamper with the request: intercept `/api/checkout/create` and change
      a quantity or inject a `price` field. The server must ignore it.
- [ ] POST to `/api/stripe/webhook` with a wrong signature → expect 400
- [ ] Let a slot hold expire mid-checkout → expect a clean "reservation
      expired" message, not a crash
- [ ] Process one real £1 live-mode payment before opening to customers

### Phase 2 VRM lookup

- [ ] **Log one real OneAutoAPI response and verify the field names in
      `normaliseOneAutoResponse()` actually match.** The parser is written
      against the documented shape, not a captured response. Until you have
      checked this, treat VRM lookup as unverified.
- [ ] Confirm a repeat lookup for the same plate hits `vrm_cache` and does
      not bill you twice
- [ ] Confirm an out-of-area postcode never reaches the paid API

### Rate limiting and bots

- [ ] 4 VRM lookups from one IP inside 10 minutes → 4th returns 429
- [ ] 6 checkout attempts from one IP inside an hour → 6th returns 429
- [ ] Set `TURNSTILE_SECRET_KEY` in production and confirm requests without
      a token are rejected

### Frontend

- [ ] Booking flow on a real mid-range Android phone, not just DevTools
- [ ] Hero motion: check frame pacing on that same phone. The active hero uses
      compositor-friendly CSS depth motion rather than WebGL; reduce or disable
      the idle motion if a target device still stutters.
- [ ] Keyboard-only pass through the entire booking flow
- [ ] Enable "reduce motion" in OS settings and confirm the site still works

---

## Known gaps

These are deliberately unbuilt, not oversights:

- **Admin operations** — protected Phase 1 shells exist, but persistent booking,
  inventory and slot operations are Phase 3. Do not use a production Supabase
  table editor as a substitute for the missing audited workflows.
- **Manage-booking page** (`/manage/[token]`) — a route shell exists; persistent
  secure tokens and reschedule/cancel workflows are Phase 3.
- **Automated tests** — no Playwright or Vitest suite. The checklist above
  is the manual substitute.
- **Payment page** (`/booking/pay`) — the development mock is gated; no real
  PaymentIntent or Stripe Elements flow exists yet.

---

## Project layout

```
src/
├── app/
│   ├── page.tsx                 Homepage: CSS-depth hero + tyre finder
│   ├── tyres/                   Catalogue results
│   ├── confirmation/[ref]/      Post-payment summary
│   └── api/
│       ├── vrm/lookup/          Gated vehicle lookup
│       ├── admin/               Phase 1 authentication and guarded mutations
│       ├── holds/               Development mock gate; Phase 3 pending
│       └── checkout/            Development mock gate; Phase 3 pending
├── components/
│   ├── 3d/                      Legacy React Three Fiber scene (inactive)
│   ├── animations/              CSS/IntersectionObserver reveals + hero tilt
│   ├── booking/                 TyreFinder gate
│   ├── layout/                  Header, Footer
│   └── ui/                      MStripe
├── lib/
│   ├── auth/admin.ts            server-side role and active-account guard
│   ├── env*.ts                  validated public/server environment contracts
│   ├── supabase/                browser, SSR and server-only admin clients
│   ├── oneauto.ts               Phase 2 integration boundary
│   ├── postcodes.ts             coverage checking
│   ├── rateLimit.ts             Postgres-backed throttling
│   ├── turnstile.ts             bot verification
│   ├── validation.ts            Zod schemas, UK reg/postcode rules
│   └── email.ts                 Resend templates
└── types/index.ts               shared types

supabase/
├── migrations/                 ordered V3 schema, policies and indexes
├── archive/                     retired legacy SQL; never execute
└── seed.sql                     comments only; no business seed data

DESIGN.md                        design system — read before UI work
```

---

## Design system

`DESIGN.md` is the single source of truth for colour, type, spacing, and
motion. `globals.css` implements it as CSS custom properties; `tailwind.config.ts`
maps Tailwind utilities onto those same properties.

Never hardcode a hex value in a component. If you need a colour that is not
in the token set, add it to both files first.

When prompting an AI agent to build UI for this project, paste the
"Agent Prompt Guide" section at the bottom of `DESIGN.md` into the prompt.
