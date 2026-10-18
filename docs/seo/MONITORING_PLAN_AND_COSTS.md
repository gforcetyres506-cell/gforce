# G Force Tyres Mobile — SEO, AEO & Visibility Monitoring Plan

**Date:** October 18, 2026  
**Status:** Zero-Cost Baseline Configured & Ready for Owner Activation  

---

## 1. 26-Query Monitoring Set

This query set monitors four core search categories: Branded Discovery, Commercial Mobile Intent, Informational/AEO Questions, and Service Logistics.

### Category 1: Branded & Entity Queries (4 Queries)
1. `G Force Tyres Mobile`
2. `G Force Tyres Mobile booking`
3. `G Force mobile tyre fitting`
4. `G Force Tyres mobile puncture repair`

### Category 2: Commercial Mobile Fitting Intent (8 Queries)
5. `mobile tyre fitting`
6. `mobile tyre replacement at home`
7. `emergency mobile tyre fitting near me`
8. `same day mobile tyre fitting`
9. `mobile tyre fitting at work`
10. `mobile tyre fitting with wheel balancing`
11. `mobile tyre fitting flat tyre`
12. `book mobile tyre fitter online`

### Category 3: Customer Informational & AEO Questions (10 Queries)
13. `how to read tyre size`
14. `what does 205 55 r16 mean`
15. `what does 225 45 r18 mean on a tyre`
16. `can a punctured tyre be repaired`
17. `puncture repair bs au 159 legal criteria`
18. `can tyre sidewall puncture be repaired`
19. `when should I replace my tyres uk`
20. `20p coin tyre tread test`
21. `what does 91v mean on tyre`
22. `what does xl mean on a tyre`

### Category 4: Logistics & Customer Journey Questions (4 Queries)
23. `what happens before mobile tyre fitting appointment`
24. `mobile tyre fitting locking wheel nut key`
25. `ground requirements for mobile tyre fitting`
26. `how are bank transfer tyre bookings confirmed`

---

## 2. Research on SamJale AI Visibility Tracker & SearchApi.io Costs

The reference repository [`SamJale/ai-visibility-tracker`](https://github.com/SamJale/ai-visibility-tracker) extracts brand citations and source grounding URLs from search engine AI answers (such as Google AI Overviews and Perplexity).

### SearchApi.io Cost Structure
- **Free Trial:** 100 free searches upon registration.
- **Micro / Pay-As-You-Go Plan:** Approx. **\$0.002 to \$0.005 per API query**.
- **Starter Plan:** **\$49 / month** for 25,000 queries.
- **Estimated Operational Cost for G Force Tyres Mobile:**
  - Tracking the 26-query monitoring set across 2 engines (Google AI Overview + Perplexity) = **52 calls per scan**.
  - **Weekly Scan (Recommended):** 52 queries &times; 4 weeks = **208 queries / month** &rarr; **\$0.42 to \$1.04 / month** (or covered entirely by introductory credits).
  - **Daily Scan:** 52 queries &times; 30 days = **1,560 queries / month** &rarr; **\$3.12 to \$7.80 / month**.

### Crucial Safeguard
> [!IMPORTANT]
> **No paid API subscriptions have been enabled.** The owner must evaluate and approve any recurring paid third-party API service before live scraping is scheduled.

---

## 3. Zero-Cost Baseline Monitoring via Google Search Console

Because Google Search Console domain ownership is already verified for `gforcetyres-mobile.co.uk`, the owner has immediate access to **100% free, first-party, authoritative search data**:

### Step-by-Step Search Console Tracking Process
1. Log into [search.google.com/search-console](https://search.google.com/search-console).
2. Navigate to **Performance &gt; Search Results**.
3. Set Date Range to **Last 28 days**.
4. Check all four metric cards:
   - **Total Clicks**
   - **Total Impressions**
   - **Average CTR**
   - **Average Position**
5. Filter or search by the 26 queries listed in Section 1 above.
6. Export the data monthly to track ranking velocity and organic impression growth.

---

## 4. 30-Day Technical SEO & Indexing Roadmap

- **Days 1–3:** Deploy code changes (favicons, updated `sitemap.xml`, `/guides/` hub and guides, `public/llms.txt`).
- **Days 4–7:** Request re-indexing of `https://www.gforcetyres-mobile.co.uk` and `/sitemap.xml` in Google Search Console. Verify Google Favicon user-agent fetches `/favicon.ico` and `/icon-48.png`.
- **Days 8–14:** Monitor Search Console **Pages &gt; Indexing** tab to verify all 11 public canonical URLs transition to "Indexed".
- **Days 15–21:** Set up Google Business Profile according to [`docs/seo/GOOGLE_BUSINESS_PROFILE_SETUP.md`](file:///e:/Taqi%20Project/gforce-production-recovery/docs/seo/GOOGLE_BUSINESS_PROFILE_SETUP.md). Submit video verification.
- **Days 22–30:** Review first Search Console Search Analytics report; check impressions for "mobile tyre fitting", "how to read tyre size", and "205 55 r16".
