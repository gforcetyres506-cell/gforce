# Indexing release gate

**INDEXING READY: NO. PRODUCTION READY: NO.**

Do not request indexing, submit the sitemap to accounts or deploy this branch automatically. Technical work on the branch does not certify the current hosted site. The live audit records a different, unattested deployment.

| Mandatory gate | Required evidence |
| --- | --- |
| HTTPS and public certificate | Trusted hostname/chain and current validity for both hosts; direct desktop/mobile browser acceptance |
| Canonical routing | Four protocol/host variants reach HTTPS www permanently; review the existing two-hop HTTP apex route in Vercel |
| Headers | Accepted deployment emits the tested CSP, HSTS, nosniff, frame, referrer and capability policies; no preload |
| Robots | Production `/robots.txt` returns 200, public pages crawlable, sitemap URL correct |
| Sitemap | Production XML returns 200; only useful canonical pages; no tokens or utility routes |
| Metadata | Rendered production HTML has one accurate canonical, title, description and social preview per indexable page |
| Structured data | JSON parses, matches visible owner-approved facts and passes external validation where applicable |
| Contact | Real business phone configured and inbound call tested; any email/WhatsApp route actually works |
| Coverage | Real owner-approved service areas match booking zones; no invented place names |
| Catalogue | Real products, prices, stock and approved images, or honestly unavailable and non-bookable |
| Booking | Controlled hosted end-to-end booking, bank verification and resource-race acceptance, or explicitly unavailable without success claims |
| Legal | Approved privacy, terms, cancellation/refund wording and privacy contact published; actual consent requirements assessed |
| UX | No P0/P1 customer journey defects; seven-width, keyboard, reduced-motion and physical-device checks accepted |
| Dependencies | Fresh full/runtime npm audits assessed; release-relevant high/critical findings resolved safely |
| Production operations | Exact source SHA deployment accepted, monitoring/incident ownership set, backups/restore/rollback evidenced |

Owner/legal sign-off must identify the actual data controller, privacy rights/contact, retention and processors, service/payment/cancellation/refund terms, and the real bank-transfer process. Do not use a decorative consent banner. The current source integrates no audience/advertising analytics; session cookies and Turnstile still require an accurate privacy/technology assessment. Any future non-essential tracking needs consent before loading where required.

Approval record: business owner **UNASSIGNED**; legal reviewer **UNASSIGNED**; release operator **UNASSIGNED**; date **NOT APPROVED**. Assign real people privately before launch. Search Console and GBP status remain HUMAN ACTION REQUIRED.

After all gates pass, follow `GOOGLE_SEARCH_CONSOLE.md`, then inspect actual indexing and chosen canonicals. Search engine discovery and rankings remain outside this code acceptance.
