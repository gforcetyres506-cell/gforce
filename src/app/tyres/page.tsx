import type { Metadata } from 'next';
import TyreCatalogue from '@/components/booking/TyreCatalogue';
export const metadata: Metadata = {
  title: 'Browse Tyres by Size',
  description: 'Compare budget, standard and premium tyres by size, season and specification.',
  // Keep the empty/unaccepted catalogue out of search until real owner data
  // and hosted stock/pricing acceptance pass. Filters never enter the sitemap.
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

export default function TyresPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <TyreCatalogue searchParams={searchParams} />;
}
