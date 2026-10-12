# Google Search Console handoff

Status: **HUMAN ACTION REQUIRED. Do not request indexing until the release checklist passes.**

1. In the business-owned Google account, add `gforcetyres-mobile.co.uk` as a **Domain property**. This covers both protocols and hostnames.
2. Copy the exact DNS TXT record supplied by Google. This repository contains no verification token.
3. In GoDaddy's `gforcetyres-mobile.co.uk` DNS zone, add **Type: TXT; Name/Host: @ (zone apex); Value: the exact `google-site-verification=...` token issued for this Domain property; TTL: provider default**. The actual token is UNKNOWN until the owner opens the property. Follow any property-specific placement instructions Google supplies. Preserve existing TXT, MX, SPF, DKIM, DMARC and other DNS records. Do not change nameservers or delete email records.
4. Verify the property after DNS propagation. Record the property owner, verification date and evidence in the private operations handoff; do not commit account credentials.
5. After production acceptance, inspect `https://www.gforcetyres-mobile.co.uk/`, choose **Test live URL**, and check HTTPS, crawl access, the rendered page and declared canonical.
6. Submit `https://www.gforcetyres-mobile.co.uk/sitemap.xml`. Request homepage indexing only after all mandatory gates pass.
7. Inspect `/mobile-tyre-fitting`, `/how-it-works`, `/coverage`, `/contact` and `/guides/tyre-size`. Never submit customer management, confirmation, account, admin, API or checkout URLs.
8. Monitor Pages, Security Issues, Manual Actions, Core Web Vitals and Performance. A sitemap submission or indexing request does not guarantee indexing, a chosen canonical or rankings.

The current catalogue and unapproved policy pages deliberately remain noindex and outside the sitemap. Review the catalogue policy after real stock/prices and hosted acceptance pass. Check Google-selected canonical after crawling; declaring a canonical does not force Google's selection.

Source: [Google ownership verification](https://support.google.com/webmasters/answer/9008080), [canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [sitemap submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
