import Link from 'next/link';
import MStripe from '@/components/ui/MStripe';
import StructuredData from '@/components/StructuredData';
import { SITE_ORIGIN } from '@/lib/site';

export default function InformationPage({ title, intro, path, breadcrumbs, children }: {
  title: string;
  intro: string;
  path: string;
  breadcrumbs?: Array<{ name: string; path: string }>;
  children: React.ReactNode;
}) {
  const trail = breadcrumbs || [
    { name: 'Home', path: '/' },
    { name: title, path },
  ];
  const items = trail.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${item.path}`,
  }));

  return <div className="container-g section max-w-3xl">
    <StructuredData data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items }} />
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-2">
      {trail.map((item, index) => {
        const isLast = index === trail.length - 1;
        return (
          <span key={item.path}>
            {index > 0 && <span aria-hidden="true"> / </span>}
            {isLast ? <span>{item.name}</span> : <Link href={item.path} className="underline hover:text-ink-1">{item.name}</Link>}
          </span>
        );
      })}
    </nav>
    <MStripe className="mb-6" /><h1 className="display-2 mb-6">{title}</h1>
    <p className="mb-8 text-ink-2 leading-relaxed">{intro}</p>
    <div className="card space-y-7 text-sm text-ink-2 leading-relaxed">{children}</div>
    <nav aria-label="More information" className="mt-8 flex flex-wrap gap-3">
      <Link href="/#tyre-finder" className="btn btn-primary">Check postcode and tyre size</Link>
      <Link href="/guides" className="btn btn-secondary">All tyre guides</Link>
      <Link href="/coverage" className="btn btn-secondary">Fitting coverage</Link>
      <Link href="/contact" className="btn btn-secondary">Contact us</Link>
    </nav>
  </div>;
}
