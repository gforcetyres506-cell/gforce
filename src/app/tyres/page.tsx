import type { Metadata } from 'next';
import TyreCatalogue from '@/components/booking/TyreCatalogue';
export const metadata: Metadata = {
  title: 'Browse Tyres by Size',
  description: 'Compare budget, standard and premium tyres by size, season and specification.',
};

export const dynamic = 'force-dynamic';

export default function TyresPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <TyreCatalogue searchParams={searchParams} />;
}
