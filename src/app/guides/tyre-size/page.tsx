import Link from 'next/link';
import InformationPage from '@/components/content/InformationPage';
import StructuredData from '@/components/StructuredData';
import { publicMetadata } from '@/lib/site';

export const metadata = publicMetadata(
  '/guides/tyre-size',
  'How to Read Your Tyre Size & What 205/55 R16 Means',
  'Learn how to read tyre size markings on your sidewall. Understand width, aspect ratio, radial construction, rim diameter (e.g. 205/55 R16 or 225/45 R18), and speed ratings.'
);

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I read my tyre size?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Look at the raised letters and numbers printed on your tyre sidewall, such as 205/55 R16 91V. The first number is width in millimetres (205), the second is the profile aspect ratio percentage (55%), R stands for radial construction, 16 is the rim diameter in inches, 91 is the load index, and V is the speed rating.',
      },
    },
    {
      '@type': 'Question',
      name: 'What does 205/55 R16 mean?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '205/55 R16 is the most common tyre size in the UK. 205 means the tyre is 205mm wide, 55 means the sidewall height is 55% of the 205mm width (approximately 112.75mm), R indicates radial construction, and 16 indicates it fits a 16-inch wheel rim.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can front and rear tyre sizes be different?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Many high-performance, executive, and rear-wheel-drive vehicles (such as BMW, Mercedes-Benz, and Porsche) use a staggered fitment, where the rear tyres are wider than the front tyres. Always check both front and rear tyre sidewalls before booking replacements.',
      },
    },
  ],
};

export default function TyreSizeGuide() {
  return (
    <InformationPage
      path="/guides/tyre-size"
      title="How to read your tyre size"
      intro="Tyre sizes look like a complex code, but each segment represents a crucial measurement needed to ensure replacement tyres fit your wheels and meet vehicle safety requirements."
      breadcrumbs={[
        { name: 'Home', path: '/' },
        { name: 'Tyre guides', path: '/guides' },
        { name: 'How to read your tyre size', path: '/guides/tyre-size' },
      ]}
    >
      <StructuredData data={faqSchema} />

      <p className="text-xs text-ink-3">
        Updated <time dateTime="2026-10-18">18 October 2026</time> &bull; 4 min read
      </p>

      {/* Direct Answer Box for AEO */}
      <div className="rounded-lg border border-brand/30 bg-surface-2 p-4 text-ink-1">
        <h2 className="text-base font-bold text-brand mb-1">Direct Answer: How to read your tyre size</h2>
        <p className="text-sm leading-relaxed">
          Check the outer sidewall of your tyre for a sequence such as <strong className="text-brand">205/55 R16 91V</strong>. The numbers break down as follows:
          <span className="block mt-2 font-mono text-xs text-ink-2 bg-void p-2 rounded">
            205 (Width mm) / 55 (Profile %) &bull; R (Radial) &bull; 16 (Wheel Rim inches) &bull; 91 (Load Index) &bull; V (Speed Rating)
          </span>
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-3">What does 205/55 R16 mean?</h2>
        <p className="mb-3">
          <strong className="text-ink-1">205/55 R16</strong> is the most widely fitted tyre size across the UK, common on popular hatchbacks and family saloons like the VW Golf, Ford Focus, and Vauxhall Astra.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <caption className="sr-only">Explanation of 205/55 R16 tyre size</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="p-2 font-semibold text-ink-1">Code</th>
                <th scope="col" className="p-2 font-semibold text-ink-1">Measurement</th>
                <th scope="col" className="p-2 font-semibold text-ink-1">What it means</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <th scope="row" className="p-2 font-mono font-medium text-brand">205</th>
                <td className="p-2 text-ink-1">Tyre Width</td>
                <td className="p-2">Nominal width of the tyre in millimetres from sidewall to sidewall (205 mm).</td>
              </tr>
              <tr>
                <th scope="row" className="p-2 font-mono font-medium text-brand">55</th>
                <td className="p-2 text-ink-1">Aspect Ratio (Profile)</td>
                <td className="p-2">Sidewall height as a percentage of width (55% of 205 mm = approx. 112.75 mm).</td>
              </tr>
              <tr>
                <th scope="row" className="p-2 font-mono font-medium text-brand">R</th>
                <td className="p-2 text-ink-1">Internal Construction</td>
                <td className="p-2">Radial ply construction, standard in modern road vehicle tyres.</td>
              </tr>
              <tr>
                <th scope="row" className="p-2 font-mono font-medium text-brand">16</th>
                <td className="p-2 text-ink-1">Wheel Rim Diameter</td>
                <td className="p-2">Diameter of the wheel rim in inches that this tyre is manufactured to fit.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-3">Comparing another common size: 225/45 R18</h2>
        <p className="mb-3">
          Sportier vehicles and larger alloy wheels often use wider, lower-profile tyres such as <strong className="text-ink-1">225/45 R18</strong>:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-ink-1">225:</strong> 225 mm wide tyre (20 mm wider than a 205).</li>
          <li><strong className="text-ink-1">45:</strong> Lower 45% profile ratio, providing stiffer handling response but firmer ride over potholes.</li>
          <li><strong className="text-ink-1">R18:</strong> Fits an 18-inch wheel rim.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Where else to verify your tyre size</h2>
        <p className="mb-3">
          While registration lookups provide vehicle estimates, previous owners may have installed different wheels or optional factory alloy packages. You can verify your approved sizes in:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-ink-1">The driver&apos;s door pillar placard:</strong> A sticker inside the driver door jamb displays approved tyre sizes and cold inflation pressures.</li>
          <li><strong className="text-ink-1">Inside the fuel filler flap:</strong> Many European cars list tyre size combinations here.</li>
          <li><strong className="text-ink-1">The vehicle owner&apos;s manual:</strong> Lists all factory-approved tyre sizes, load ratings, and winter tyre recommendations.</li>
          <li><strong className="text-ink-1">The physical tyre currently fitted:</strong> Always inspect the tyre on the vehicle itself before completing an order.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Staggered fitments &amp; run-flat tyres</h2>
        <p className="mb-3">
          <strong className="text-ink-1">Staggered fitment:</strong> On performance cars (such as BMW M-Sport or Mercedes AMG-Line), the front and rear tyres often differ in width (e.g., 225/40 R19 on the front and 255/35 R19 on the rear). If replacing both axles, inspect both front and rear sidewalls.
        </p>
        <p>
          <strong className="text-ink-1">Run-flat tyres (RFT):</strong> Designed with reinforced sidewalls allowing you to drive up to 50 miles at 50 mph after a puncture. Look for markings like <strong className="text-ink-1">RFT</strong> (Bridgestone), <strong className="text-ink-1">ROF</strong> (Goodyear), <strong className="text-ink-1">SSR</strong> (Continental), or <strong className="text-ink-1">ZP</strong> (Michelin).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Related tyre guides</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <Link href="/guides/load-speed-ratings" className="underline hover:text-ink-1">
              Tyre load index &amp; speed symbols guide
            </Link>
          </li>
          <li>
            <Link href="/guides/puncture-repair" className="underline hover:text-ink-1">
              Can a punctured tyre be repaired? (BS AU 159 criteria)
            </Link>
          </li>
          <li>
            <Link href="/guides/mobile-fitting-checklist" className="underline hover:text-ink-1">
              Mobile tyre fitting appointment checklist
            </Link>
          </li>
        </ul>
      </section>
    </InformationPage>
  );
}
