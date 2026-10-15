import Link from 'next/link';
import MStripe from '@/components/ui/MStripe';
import StructuredData from '@/components/StructuredData';
import { SITE_ORIGIN } from '@/lib/site';

export default function InformationPage({ title, intro, path, children }: {
  title: string; intro: string; path: string; children: React.ReactNode;
}) {
  return <div className="container-g section max-w-3xl">
    <StructuredData data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN + '/' },
      { '@type': 'ListItem', position: 2, name: title, item: SITE_ORIGIN + path },
    ] }} />
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-2"><Link href="/" className="underline">Home</Link><span aria-hidden="true"> / </span>{title}</nav>
    <MStripe className="mb-6" /><h1 className="display-2 mb-6">{title}</h1>
    <p className="mb-8 text-ink-2 leading-relaxed">{intro}</p>
    <div className="card space-y-7 text-sm text-ink-2 leading-relaxed">{children}</div>
    <nav aria-label="More information" className="mt-8 flex flex-wrap gap-3">
      <Link href="/#tyre-finder" className="btn btn-primary">Check postcode and tyre size</Link>
      <Link href="/coverage" className="btn btn-secondary">Fitting coverage</Link>
      <Link href="/contact" className="btn btn-secondary">Contact us</Link>
    </nav>
  </div>;
}
