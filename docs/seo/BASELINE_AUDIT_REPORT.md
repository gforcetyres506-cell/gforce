# G Force Tyres Mobile — Phase A Baseline SEO / GEO / AEO Audit Report

**Date of Audit:** October 18, 2026  
**Audited Domain:** `https://www.gforcetyres-mobile.co.uk` (Canonical)  
**Production Hosting:** Vercel  
**Deployed Production SHA:** `d15b201ef527204d6e983e35735e985537f89aed` (PR #4)  
**Google Search Console:** Verified domain ownership  

---

## 1. Executive Summary

This baseline audit evaluates the live production deployment of G Force Tyres Mobile prior to applying Phase B–F SEO enhancements. The site is fast, modern, and has clean security headers (CSP, HSTS, X-Content-Type-Options: nosniff). However, several key technical and local SEO opportunities and defects exist:

1. **Favicon Defect on Production:**  
   - `GET /favicon.ico` returns **404 Not Found** (served as HTML 28KB error page).
   - Only `icon.png` and `apple-icon.png` existed on the live deployment. Googlebot searches specifically for `/favicon.ico` and 48x48+ icons.
   - The original `icon.png` was a 512×512 horizontal letterboxed asset that scaled poorly to 16×16px tab icon sizes.
2. **AI Crawler & Search Engine Accessibility:**  
   - All tested bots (`Googlebot`, `Googlebot-Image`, `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Applebot`) return **200 OK** with fast latencies (~280–370ms).
   - `robots.txt` currently uses wildcard `User-Agent: *` without explicit declarations for AI answer crawlers.
3. **Sitemap Coverage:**  
   - Only 6 pages currently indexed in `sitemap.xml`: `/`, `/mobile-tyre-fitting`, `/how-it-works`, `/coverage`, `/contact`, `/guides/tyre-size`.
   - Core educational and service landing pages are missing or limited.
4. **Structured Data:**  
   - Basic `Organization`, `Service`, and `BreadcrumbList` exist on some pages.
   - Missing rich answers / FAQ structured data for direct answer engine optimization (AEO).
   - Missing `llms.txt` for direct markdown consumption by AI agents.
5. **Local Identity:**  
   - Need to maintain absolute separation between `G Force Tyres Mobile` and `gforcetyres.co.uk`.
   - Coverage page needs explicit vehicle placement safety criteria (flat hard standing, clear turning space) and verified fitting operations.

---

## 2. Live HTTP Status & Header Evidence

Raw crawl evidence saved at [`docs/seo/BASELINE_CRAWL_EVIDENCE.json`](file:///e:/Taqi%20Project/gforce-production-recovery/docs/seo/BASELINE_CRAWL_EVIDENCE.json).

| Route | Status | Latency (ms) | Content-Type | Security Headers (CSP / HSTS / Nosniff) |
|---|---|---|---|---|
| `/` | 200 | 627 | text/html; charset=utf-8 | Yes / Yes / Yes |
| `/mobile-tyre-fitting` | 200 | 310 | text/html; charset=utf-8 | Yes / Yes / Yes |
| `/how-it-works` | 200 | 288 | text/html; charset=utf-8 | Yes / Yes / Yes |
| `/coverage` | 200 | 305 | text/html; charset=utf-8 | Yes / Yes / Yes |
| `/contact` | 200 | 290 | text/html; charset=utf-8 | Yes / Yes / Yes |
| `/guides/tyre-size` | 200 | 295 | text/html; charset=utf-8 | Yes / Yes / Yes |
| `/tyres` | 200 | 292 | text/html; charset=utf-8 | Yes / Yes / Yes |
| `/privacy` | 200 | 289 | text/html; charset=utf-8 | Yes / Yes / Yes |
| `/terms` | 200 | 298 | text/html; charset=utf-8 | Yes / Yes / Yes |

### Redirect Matrix

| Inbound URL | Response Status | Target Location | Result |
|---|---|---|---|
| `http://gforcetyres-mobile.co.uk/` | 308 Permanent Redirect | `https://gforcetyres-mobile.co.uk/` | Passed (Apex HTTP -> Apex HTTPS) |
| `https://gforcetyres-mobile.co.uk/` | 308 Permanent Redirect | `https://www.gforcetyres-mobile.co.uk/` | Passed (Apex HTTPS -> Canonical WWW) |
| `http://www.gforcetyres-mobile.co.uk/` | 308 Permanent Redirect | `https://www.gforcetyres-mobile.co.uk/` | Passed (WWW HTTP -> Canonical WWW) |

---

## 3. Robots.txt and Sitemap.xml Status

### Current Live `robots.txt`:
```text
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /prototype/
Disallow: /preview/
Disallow: /test/

Sitemap: https://www.gforcetyres-mobile.co.uk/sitemap.xml
```
- **Evaluation:** Clean and secure disallows on administrative, test, and private API routes. Does not disallow any public pages.
- **Improvement:** Add explicit bot permissions for modern AI engines (GPTBot, ClaudeBot, PerplexityBot, Applebot-Extended) to guarantee citation crawling.

### Current Live `sitemap.xml`:
- Contains 6 URLs:
  - `https://www.gforcetyres-mobile.co.uk`
  - `https://www.gforcetyres-mobile.co.uk/mobile-tyre-fitting`
  - `https://www.gforcetyres-mobile.co.uk/how-it-works`
  - `https://www.gforcetyres-mobile.co.uk/coverage`
  - `https://www.gforcetyres-mobile.co.uk/contact`
  - `https://www.gforcetyres-mobile.co.uk/guides/tyre-size`
- **Evaluation:** Valid syntax and schema. Needs updating to include new educational customer guides.

---

## 4. Live Bot Access Audit

| Crawler | Status Code | Latency | Verification |
|---|---|---|---|
| Chrome Standard Browser | 200 | 304ms | OK |
| Googlebot | 200 | 368ms | OK |
| Googlebot-Image | 200 | 297ms | OK |
| GPTBot (OpenAI) | 200 | 284ms | OK |
| ClaudeBot (Anthropic) | 200 | 297ms | OK |
| PerplexityBot | 200 | 285ms | OK |
| Applebot | 200 | 299ms | OK |

All web crawlers and AI search agents receive immediate 200 responses with full server-rendered HTML payloads. No WAF or Cloudflare captcha interference.

---

## 5. Favicon and Visual Identity Verification

| Endpoint | Live Status | Codebase Local Status (Phase B Fix) | Fix Details |
|---|---|---|---|
| `/favicon.ico` | **404 Not Found** | **200 OK** | Generated multi-res ICO (16, 32, 48px) cropped from authentic `public/brand/g-force-tyres-logo.webp` |
| `/icon.png` | 200 OK | 200 OK | 512×512 square high-resolution brand icon |
| `/apple-icon.png` | 200 OK | 200 OK | 180×180 iOS touch icon with brand dark border |
| `/icon-48.png` | **404 Not Found** | **200 OK** | 48×48 Google search snippet recommended size |
| `/icon-192.png` | **404 Not Found** | **200 OK** | 192×192 PWA / Android icon |

---

## 6. Action Plan for Next Phases

1. **Phase B (Technical SEO):**
   - Update `src/app/robots.ts` with AI search crawler declarations.
   - Update `src/app/sitemap.ts` with all public guide routes.
   - Ensure clean metadata and canonical tags across all pages.
2. **Phase C (Local SEO):**
   - Detail mobile tyre fitting service radius, vehicle setup requirements (flat surface, clearance), and zero competitor conflict.
   - Create Google Business Profile owner guide (`docs/seo/GOOGLE_BUSINESS_PROFILE_SETUP.md`).
3. **Phase D (Content / AEO):**
   - Build Guides index and 4 new comprehensive guides:
     1. Puncture Repair vs Replacement (BS AU 159 criteria)
     2. Mobile Fitting Checklist (What happens before appointment)
     3. When to Replace Tyres (1.6mm legal limit, 3mm wet-grip, age & damage)
     4. Load & Speed Ratings (Understanding tyre sidewall codes)
4. **Phase E (Structured Data / GEO):**
   - Add FAQPage schema to relevant guide pages for search rich snippet eligibility.
   - Add `public/llms.txt` for AI agent search grounding.
5. **Phase F (Measurement):**
   - Define 25-query local and technical SEO query tracking matrix.
   - Document SearchApi.io pricing and Search Console integration steps.
6. **Phase G (Safety & Regression):**
   - Validate zero mock data, verify all security and reliability test suites, compile production build.
