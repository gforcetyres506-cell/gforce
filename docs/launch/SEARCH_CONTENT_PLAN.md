# Search content and business facts

## Implemented foundation

The six indexable pages are `/`, `/mobile-tyre-fitting`, `/how-it-works`, `/coverage`, `/contact` and `/guides/tyre-size`. Each has a unique title/description, absolute www canonical, social metadata and server-rendered content. The homepage has Organization JSON-LD; information pages have breadcrumbs; the service page describes only mobile tyre fitting. No address, hours, locations, reviews, ratings, product prices or offers were invented.

The tyre-size guide explains one example, not vehicle suitability. Its source was read during this task: [Continental tyre markings](https://www.continental-tyres.co.uk/b2c/tyre-knowledge/tyre-markings/). No UK tyre-law, tread-depth or emergency-driving article was published.

## Owner facts workflow

`src/data/business-facts.ts` is the reviewed public entity source. `src/lib/site.ts` owns the exact name and canonical origin. `getBusinessFacts()` combines the public facts with the existing approved `BUSINESS_PHONE` and `BUSINESS_WHATSAPP` environment settings; layout, contact actions and schema share that result. Unknown values stay empty. Do not promote seed data or infer approval from a populated database field.

Before changing facts, record written owner approval privately for trading/legal identity, phone/email, services, real coverage, hours, public social links and customer-facing premises status. Reconcile public facts with operational `business_settings` and active `service_zones`. The owner must provide the same approved contacts to deployment settings; a redeploy is necessary for environment changes. Database admin settings are not automatically treated as approved SEO or legal copy.

Approve exact supplier image hostnames in `TYRE_IMAGE_HOSTS` before publishing products with remote images. Next's optimiser serves approved images from the site's origin; wildcard hosts and HTTP images are disallowed. Test at least one actual supplier image in the accepted deployment.

## Publication stages

1. **Manual validation:** owner confirms the service, reachable contact, coverage and recurring customer questions. Review real booking support requests; do not collect unnecessary customer data for content research.
2. **MVP:** use the implemented service/coverage/process/contact/size pages. Keep the catalogue noindex until real inventory/prices and hosted acceptance pass. Publish approved policies; replace unavailable states only with signed-off copy.
3. **Scalable:** add a reviewed content record and reuse `InformationPage`, `publicMetadata` and escaped `StructuredData`. Add its route to the sitemap allowlist only after publication and QA. Supply a real update date when editorial evidence exists; do not stamp every request as recently modified.
4. **Advanced discovery:** assess real Search Console queries, useful answers and conversions before adding content. There is no magic GEO tag or guaranteed AI citation. Do not add mass AI pages, unsupported schema or third-party tracking by default.

## Service and location gates

The existing components support useful service pages without generating routes in bulk. Emergency fitting, puncture repair, run-flat replacement, van tyres and other services require explicit confirmation of actual operations before a page is built. No service was inferred from a product tier or database field.

A future `/mobile-tyre-fitting/[area]` page requires genuine service coverage, written owner approval, meaningful local information and independently useful content. Include local booking/access considerations and actual service limitations. Reject city-name substitutions and doorway pages. Until those inputs exist, the route must not exist or enter the sitemap; there is no catch-all location generator.

Potential future guides: vehicle-specific fitment requirements, run-flat considerations, tyre replacement and UK tread rules. Research authoritative current government/manufacturer sources and have safety/legal claims reviewed before publication. Never infer a commercial guarantee from general educational guidance.

## Schema and crawling decisions

No Product/Offer markup until real identity, GBP price and availability are evidenced. No fake ratings/reviews, FAQPage dependency or unapproved LocalBusiness address. Search and AI-associated crawlers are not selectively blocked. Robots disallows admin/API/internal routes, while accessible utility pages use noindex. The public robots file does not list management-token patterns. Auth/token checks provide security.

Sources: [Google Organization markup](https://developers.google.com/search/docs/appearance/structured-data/organization), [noindex and crawl access](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
