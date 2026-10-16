# Google Search Console & Google Business Profile Readiness Guide

**Service:** G Force Tyres Mobile  
**Canonical Domain:** `https://www.gforcetyres-mobile.co.uk`  
**Purpose:** Actionable checklist for business owner to establish Google search presence without confusing with third-party garages.  

---

## 1. Google Search Readiness State (Codebase & Server Verified)

The repository and deployed web application have been configured with production search standards:

| Asset / Feature | Implemented Value | Verification / Status |
|---|---|---|
| **Canonical Domain** | `https://www.gforcetyres-mobile.co.uk` | Hardcoded across metadata generator, OpenGraph, and Twitter tags. |
| **Robots.txt** | `/robots.txt` disallows `/admin`, `/api/`, `/prototype/`, `/preview/`, `/test/`. Allows `/`. | Configured in `src/app/robots.ts`. Protects private and token-bearing routes. |
| **Sitemap** | `/sitemap.xml` | Generated from `SEARCH_PAGES` allowlist (`/`, `/mobile-tyre-fitting`, `/how-it-works`, `/coverage`, `/contact`, `/guides/tyre-size`). Excludes tokens and query parameters. |
| **Google Favicon Multiples** | 48x48, 192x192, 512x512, and `favicon.ico` | Google Search Favicon guidelines require exact multiples of 48px square. Generated in `public/` and declared in `layout.tsx`. |
| **Structured Data** | `Organization` & `Service` Schema | Valid JSON-LD structured data in `mobile-tyre-fitting` and layout. |
| **Entity Distinction** | Independent Mobile Operator | Explicit notice on homepage, footer, and contact page distinguishing from static brick-and-mortar garages and `gforcetyres.co.uk`. |

---

## 2. Owner Action Item: Google Search Console (GSC) Setup

*Note: As an automated agent, search engine verification cannot be claimed without owner DNS actions.*

### Step 1: Add Domain Property in Google Search Console
1. Navigate to [Google Search Console](https://search.google.com/search-console).
2. Sign in with the primary G Force Google account.
3. Select **Add Property** &rarr; choose **Domain** (not URL prefix).
4. Enter `gforcetyres-mobile.co.uk`.

### Step 2: Add DNS TXT Verification Record
1. Google will provide a TXT record (e.g. `google-site-verification=abc123xyz...`).
2. Log into your domain registrar / DNS provider (Cloudflare, GoDaddy, or Namecheap).
3. Add a new `TXT` record:
   - **Name / Host:** `@` (or `gforcetyres-mobile.co.uk`)
   - **Type:** `TXT`
   - **Value:** Paste the verification token.
   - **TTL:** Auto or 300 seconds.
4. Return to Google Search Console and click **Verify**.

### Step 3: Submit XML Sitemap
1. In the left navigation, click **Sitemaps**.
2. Under "Add a new sitemap", enter: `sitemap.xml`.
3. Click **Submit**. Verify that the status shows "Success".

### Step 4: URL Inspection & Indexing Request
1. Use the top search bar in GSC to inspect `https://www.gforcetyres-mobile.co.uk`.
2. Click **Test Live URL**.
3. Verify that:
   - "Page is fetchable" = Yes
   - "User-declared canonical" = `https://www.gforcetyres-mobile.co.uk`
   - "Google-selected canonical" matches.
4. Click **Request Indexing**.

---

## 3. Owner Action Item: Google Business Profile (GBP) for Mobile Tyre Fitting

Because G Force Tyres Mobile is a **mobile-only service** without a public walk-in depot, Google's guidelines for **Service Area Businesses (SAB)** must be strictly followed to avoid suspension or misattribution to `gforcetyres.co.uk`.

### Step 1: Create Profile as a Service Area Business
1. Go to [Google Business Profile Manager](https://business.google.com).
2. Business Name: **G Force Tyres Mobile**  
   *(Do NOT name it simply "G Force Tyres" as that confuses with static third-party garages).*
3. Primary Category: **Tyre Shop** or **Mobile Tyre Fitting Service**.

### Step 2: Address & Service Area Setting (CRITICAL)
- **Do you want to add a location customers can visit?**  
  Select **NO**.
- When prompted for your service areas:
  - Add specific South London / Surrey / Kent postal districts matching your 13 active zones (e.g. Croydon, Bromley, Sutton, Dartford, Mitcham, Beckenham, Orpington).
  - Do NOT claim "United Kingdom" nationwide coverage.

### Step 3: Business Contact & Links
- **Phone number:** Use the official business mobile number configured in Admin Settings.
- **Website URL:** `https://www.gforcetyres-mobile.co.uk`.
- **Appointment link:** `https://www.gforcetyres-mobile.co.uk/#tyre-finder`.

### Step 4: Verification Method
- Google will likely ask for video verification of your mobile fitting van (showing branded van, tools, and tyre-changing equipment) or a phone code.
- Complete the verification process using the official business van.

---

## 4. Distinction from Third-Party Entity `gforcetyres.co.uk`

| Characteristic | G Force Tyres Mobile (This Business) | Third-Party Garage (`gforcetyres.co.uk`) |
|---|---|---|
| **Service Model** | 100% Mobile Tyre Fitting to customer location (Home / Work). | Static physical garage / workshop. |
| **Website** | `https://www.gforcetyres-mobile.co.uk` | `https://gforcetyres.co.uk` |
| **Address Policy** | Service Area Business (no customer-facing premises). | Physical garage building. |
| **Brand Representation** | Black & cyan mobile fitting branding. | Separate independent entity. |

*Never link or claim association with gforcetyres.co.uk on public pages, social accounts, or Google Business Profiles.*
