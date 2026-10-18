import Link from 'next/link';
import InformationPage from '@/components/content/InformationPage';
import StructuredData from '@/components/StructuredData';
import { publicMetadata, SITE_ORIGIN } from '@/lib/site';

export const metadata = publicMetadata(
  '/guides',
  'Tyre Guides & Advice Directory',
  'Expert tyre guides and practical advice from G Force Tyres Mobile. Learn how to read tyre markings, understand speed ratings, assess puncture repairs, and prepare for mobile fitting.'
);

const GUIDES = [
  {
    href: '/guides/tyre-size',
    title: 'How to read your tyre size (205/55 R16 explained)',
    description: 'Understand the width, aspect ratio, radial construction, and rim diameter numbers on your tyre sidewall.',
    readTime: '4 min read',
  },
  {
    href: '/guides/load-speed-ratings',
    title: 'Tyre load and speed ratings guide',
    description: 'Learn how to check maximum vehicle load capacities, understand speed symbols, and choose Extra Load (XL) tyres for SUVs and EVs.',
    readTime: '4 min read',
  },
  {
    href: '/guides/puncture-repair',
    title: 'Can a punctured tyre be repaired? (BS AU 159 criteria)',
    description: 'Discover the UK legal criteria under British Standard BS AU 159, minor repair zones, and when replacement is mandatory.',
    readTime: '5 min read',
  },
  {
    href: '/guides/tyre-replacement-signs',
    title: 'When should you replace your tyres?',
    description: 'Check legal tread limits (1.6mm vs 3mm safety recommendation), learn the 20p coin test, and spot sidewall damage.',
    readTime: '5 min read',
  },
  {
    href: '/guides/mobile-fitting-checklist',
    title: 'Mobile tyre fitting appointment checklist',
    description: 'What happens before the technician arrives: parking requirements, locking wheel nut key checklist, and bank-transfer confirmation.',
    readTime: '4 min read',
  },
];

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'G Force Tyres Mobile Guides & Advice',
  itemListElement: GUIDES.map((g, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: g.title,
    url: `${SITE_ORIGIN}${g.href}`,
  })),
};

export default function GuidesHubPage() {
  return (
    <InformationPage
      path="/guides"
      title="Tyre guides &amp; advice"
      intro="Clear, practical advice from G Force Tyres Mobile to help you understand your tyre markings, maintain road safety, and prepare for mobile tyre fitting."
    >
      <StructuredData data={itemListSchema} />

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-4">Customer tyre guides</h2>
        <div className="grid gap-4 sm:grid-cols-1">
          {GUIDES.map((guide) => (
            <article
              key={guide.href}
              className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-brand/40"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-base font-semibold text-ink-1">
                  <Link href={guide.href} className="hover:text-brand hover:underline">
                    {guide.title}
                  </Link>
                </h3>
                <span className="text-xs text-ink-3 shrink-0">{guide.readTime}</span>
              </div>
              <p className="text-xs text-ink-2 leading-relaxed mb-3">
                {guide.description}
              </p>
              <Link
                href={guide.href}
                className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
              >
                Read guide &rarr;
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Need mobile tyre fitting?</h2>
        <p className="mb-2">
          Once you know your tyre size, enter your fitting postcode and dimensions into our tyre finder to see live tyre options and available appointment slots.
        </p>
        <p>
          <Link href="/mobile-tyre-fitting" className="underline hover:text-ink-1">
            Learn more about how mobile tyre fitting works
          </Link>
          {' '}&bull;{' '}
          <Link href="/coverage" className="underline hover:text-ink-1">
            Check mobile fitting coverage
          </Link>
        </p>
      </section>
    </InformationPage>
  );
}
