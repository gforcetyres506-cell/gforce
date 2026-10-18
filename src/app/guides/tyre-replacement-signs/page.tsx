import Link from 'next/link';
import InformationPage from '@/components/content/InformationPage';
import StructuredData from '@/components/StructuredData';
import { publicMetadata } from '@/lib/site';

export const metadata = publicMetadata(
  '/guides/tyre-replacement-signs',
  'When Should You Replace Your Tyres? Tread, Age & Signs',
  'Learn when to replace your tyres according to UK law and safety experts. Understand the 1.6mm legal tread limit, the 20p coin test, age limits, and sidewall damage.'
);

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is the legal tyre tread depth in the UK?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The legal minimum tyre tread depth for passenger cars in the UK is 1.6mm across the central three-quarters of the tread around the entire circumference. Driving on tyres below 1.6mm is illegal and carries penalties of up to a £2,500 fine and 3 penalty points per tyre.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do you check tyre tread depth with a 20p coin?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Place a standard 20p coin into the main grooves of your tyre. If the outer band of the 20p coin is visible above the tread, your tyre may be below the legal 1.6mm limit and should be inspected and replaced immediately by a tyre professional.',
      },
    },
    {
      '@type': 'Question',
      name: 'How old is too old for a car tyre?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Most tyre manufacturers and safety bodies recommend having tyres inspected annually once they reach 5 years of age, and replacing them completely once they reach 10 years from the date of manufacture (indicated by the 4-digit DOT code on the sidewall), even if they have substantial tread remaining.',
      },
    },
  ],
};

export default function TyreReplacementSignsPage() {
  return (
    <InformationPage
      path="/guides/tyre-replacement-signs"
      title="When should you replace your tyres?"
      intro="Your tyres are the only contact point between your vehicle and the road. Knowing the legal limits, safety thresholds, and warning signs ensures your car remains safe and road-legal."
      breadcrumbs={[
        { name: 'Home', path: '/' },
        { name: 'Tyre guides', path: '/guides' },
        { name: 'When to replace tyres', path: '/guides/tyre-replacement-signs' },
      ]}
    >
      <StructuredData data={faqSchema} />

      <p className="text-xs text-ink-3">
        Updated <time dateTime="2026-10-18">18 October 2026</time> &bull; 5 min read
      </p>

      {/* Direct Answer Snippet for AEO */}
      <div className="rounded-lg border border-brand/30 bg-surface-2 p-4 text-ink-1">
        <h2 className="text-base font-bold text-brand mb-1">Direct Answer: When to replace your tyres</h2>
        <p className="text-sm leading-relaxed mb-2">
          You must replace your tyres if any of these four conditions occur:
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-xs text-ink-2">
          <li><strong className="text-ink-1">Tread depth below 1.6mm:</strong> The UK legal minimum across the central three-quarters of the tread.</li>
          <li><strong className="text-ink-1">Wet safety recommendation (3mm):</strong> Wet braking distances increase drastically once tread drops below 3mm.</li>
          <li><strong className="text-ink-1">Physical damage:</strong> Sidewall bulges, tears, cuts exposing cords, or tread punctures exceeding 6mm.</li>
          <li><strong className="text-ink-1">Age exceeding 5 to 10 years:</strong> Rubber oxidises, perishes, and hardens regardless of mileage.</li>
        </ol>
      </div>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">The UK legal tread limit (1.6mm) vs Safety limit (3mm)</h2>
        <p className="mb-3">
          Under UK law, car tyres must have a minimum tread depth of <strong className="text-ink-1">1.6mm</strong> in a continuous band throughout the central three-quarters of the tyre width and around the entire circumference.
        </p>
        <div className="rounded border border-line bg-surface p-4 text-xs space-y-2">
          <p className="font-semibold text-ink-1">Why road safety experts recommend replacing tyres at 3mm:</p>
          <p>
            Independent testing shows that stopping distance in wet conditions from 50 mph increases by up to <strong className="text-ink-1">44%</strong> on tyres with 1.6mm of tread compared to tyres with 3mm of tread. The grooves can no longer displace standing water quickly enough, dramatically increasing the risk of aquaplaning.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">How to do the 20p tyre test</h2>
        <p className="mb-3">
          The 20p test is a quick and effective way to check whether your tyre tread is close to or below the legal minimum:
        </p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Take a standard UK 20-pence coin.</li>
          <li>Insert the coin upright into the main tread grooves across several points on the tyre.</li>
          <li>
            <strong className="text-ink-1">Look at the outer raised band:</strong> If the outer band of the coin is hidden inside the groove, your tyre is above the 1.6mm legal limit. If you can see the outer rim of the coin, your tread is likely illegal and the tyre must be replaced immediately.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">UK legal penalties and MOT impact</h2>
        <p className="mb-3">
          Driving with worn or defective tyres is a serious driving offence in the United Kingdom:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-ink-1">Fines &amp; points:</strong> Police can issue a fine of up to <strong className="text-ink-1">&pound;2,500</strong> and <strong className="text-ink-1">3 penalty points per illegal tyre</strong>. Having all four tyres below the limit can result in a &pound;10,000 fine and an immediate driving ban.
          </li>
          <li>
            <strong className="text-ink-1">MOT failure:</strong> Any tyre with tread below 1.6mm or with structural bulges or cuts is an immediate MOT Major or Dangerous fail.
          </li>
          <li>
            <strong className="text-ink-1">Insurance invalidation:</strong> If you are involved in a collision with illegal tyres, insurers may void your policy.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Visible damage signs that require immediate replacement</h2>
        <p className="mb-3">Even if your tyre has plenty of tread remaining, inspect for the following warning signs:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-ink-1">Sidewall bulges or eggs:</strong> Caused by hitting a pothole or curb, snapping the internal carcass cords. This cannot be repaired and is a severe blowout hazard.
          </li>
          <li>
            <strong className="text-ink-1">Cuts and gouges:</strong> Any cut deeper than 1mm that exposes the internal cords or ply structure.
          </li>
          <li>
            <strong className="text-ink-1">Perishing / Crazing / Dry rot:</strong> Fine spiderweb-like cracks on the sidewall caused by UV sunlight and ageing rubber compounds.
          </li>
          <li>
            <strong className="text-ink-1">Uneven shoulder wear:</strong> Severe wear on either the inside or outside edge indicates incorrect wheel alignment (tracking) or incorrect camber.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">How to check your tyre&apos;s age (DOT code)</h2>
        <p className="mb-3">
          On the tyre sidewall, look for the letters <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">DOT</code> followed by a series of letters and a 4-digit number (often in an oval frame).
        </p>
        <p>
          The 4 digits tell you the exact manufacture date: the first two digits represent the week, and the last two represent the year. For example, <strong className="text-ink-1">3521</strong> means the tyre was manufactured in the 35th week of 2021. Tyres older than 10 years should always be replaced regardless of remaining tread.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Related tyre guides</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <Link href="/guides/tyre-size" className="underline hover:text-ink-1">
              How to read your tyre size
            </Link>
          </li>
          <li>
            <Link href="/guides/puncture-repair" className="underline hover:text-ink-1">
              Can a punctured tyre be repaired?
            </Link>
          </li>
          <li>
            <Link href="/guides/load-speed-ratings" className="underline hover:text-ink-1">
              Tyre load and speed ratings guide
            </Link>
          </li>
        </ul>
      </section>
    </InformationPage>
  );
}
