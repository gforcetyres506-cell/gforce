import Link from 'next/link';
import InformationPage from '@/components/content/InformationPage';
import StructuredData from '@/components/StructuredData';
import { publicMetadata, SITE_NAME, SITE_ORIGIN } from '@/lib/site';

export const metadata = publicMetadata('/mobile-tyre-fitting', 'Mobile Tyre Fitting Service', 'Find out how mobile tyre fitting works with G Force Tyres Mobile. Check your postcode and tyre size before choosing available tyres.');
export default function ServicePage() {
  return <InformationPage path="/mobile-tyre-fitting" title="Mobile tyre fitting" intro={`${SITE_NAME} provides mobile tyre fitting. Start with the vehicle's postcode to check whether fitting is available at that location.`}>
    <StructuredData data={{ '@context': 'https://schema.org', '@type': 'Service', '@id': SITE_ORIGIN + '/mobile-tyre-fitting#service',
      name: 'Mobile tyre fitting', serviceType: 'Mobile tyre fitting', url: SITE_ORIGIN + '/mobile-tyre-fitting', provider: { '@id': SITE_ORIGIN + '/#organization' } }} />
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">At your fitting location</h2><p>Check coverage before selecting tyres. Home or workplace fitting depends on the service area, appointment availability and a suitable place to work. Contact us if you are unsure about access.</p></section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">Choose the correct tyre</h2><p>Enter the width, profile and rim size from the tyre sidewall. Size alone does not establish suitability: load rating, speed rating and vehicle requirements also matter. <Link href="/guides/tyre-size" className="underline">Read the tyre-size guide</Link> and ask a fitter if the markings are unclear.</p></section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">Review before booking</h2><p>The booking process checks stock, pricing and fitting availability. If those checks are unavailable, it cannot confirm a booking. <Link href="/how-it-works" className="underline">See the booking and bank-transfer steps</Link>.</p></section>
    <Link href="/tyres" className="inline-flex min-h-11 items-center underline">Browse the tyre catalogue</Link>
  </InformationPage>;
}
