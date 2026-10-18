import Link from 'next/link';
import InformationPage from '@/components/content/InformationPage';
import StructuredData from '@/components/StructuredData';
import { publicMetadata } from '@/lib/site';

export const metadata = publicMetadata(
  '/guides/load-speed-ratings',
  'Tyre Load and Speed Ratings Guide',
  'Understand tyre load index and speed ratings on your tyres. Learn how to check maximum vehicle weight capacities, speed symbols, and XL tyre requirements.'
);

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What does the load index on a tyre mean?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The load index is a numerical code printed on the sidewall (e.g. 91 in 205/55 R16 91V) that indicates the maximum weight a single tyre can safely carry when inflated to its maximum pressure. A load index of 91 corresponds to a maximum capacity of 615 kg per tyre.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I fit tyres with a lower speed rating than manufacturer spec?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. In the UK, fitting tyres with a lower load index or lower speed rating than the vehicle manufacturer specified is dangerous, may cause an MOT failure, and can invalidate your vehicle insurance. You may, however, fit tyres with higher load or speed ratings.',
      },
    },
    {
      '@type': 'Question',
      name: 'What does XL mean on a tyre?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'XL stands for Extra Load (sometimes marked as Reinforced or RF). XL tyres have a reinforced internal casing allowing them to carry higher loads at higher inflation pressures than standard tyres of the same dimension. They are standard equipment on SUVs, estate cars, and electric vehicles (EVs).',
      },
    },
  ],
};

export default function LoadSpeedRatingsGuidePage() {
  return (
    <InformationPage
      path="/guides/load-speed-ratings"
      title="Tyre load and speed ratings guide"
      intro="Tyre size is only half the story. The numbers and letter following your tyre size indicate the maximum weight and speed your tyre is certified to handle safely."
      breadcrumbs={[
        { name: 'Home', path: '/' },
        { name: 'Tyre guides', path: '/guides' },
        { name: 'Load & speed ratings', path: '/guides/load-speed-ratings' },
      ]}
    >
      <StructuredData data={faqSchema} />

      <p className="text-xs text-ink-3">
        Updated <time dateTime="2026-10-18">18 October 2026</time> &bull; 4 min read
      </p>

      {/* Direct Answer Snippet for AEO */}
      <div className="rounded-lg border border-brand/30 bg-surface-2 p-4 text-ink-1">
        <h2 className="text-base font-bold text-brand mb-1">Direct Answer: How to check load and speed ratings</h2>
        <p className="text-sm leading-relaxed mb-2">
          Find the two characters positioned immediately after the rim diameter on your tyre sidewall (e.g. in <strong className="text-brand">205/55 R16 91V</strong>):
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-ink-2">
          <li><strong className="text-ink-1">91 = Load Index:</strong> Maximum load capacity of <strong className="text-ink-1">615 kg</strong> per tyre.</li>
          <li><strong className="text-ink-1">V = Speed Symbol:</strong> Maximum certified road speed of <strong className="text-ink-1">149 mph (240 km/h)</strong>.</li>
        </ul>
      </div>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-3">Common tyre load index table</h2>
        <p className="mb-3">
          Multiply the single tyre load capacity by 4 to calculate the maximum gross axle support for your car:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <caption className="sr-only">Tyre load index conversion table</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="p-2 font-semibold text-ink-1">Load Index</th>
                <th scope="col" className="p-2 font-semibold text-ink-1">Max Weight per Tyre (kg)</th>
                <th scope="col" className="p-2 font-semibold text-ink-1">Max Axle Capacity (2 tyres)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr><th scope="row" className="p-2 font-mono text-brand">88</th><td className="p-2">560 kg</td><td className="p-2">1,120 kg</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">91</th><td className="p-2">615 kg</td><td className="p-2">1,230 kg</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">94</th><td className="p-2">670 kg</td><td className="p-2">1,340 kg</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">95</th><td className="p-2">690 kg</td><td className="p-2">1,380 kg</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">98</th><td className="p-2">750 kg</td><td className="p-2">1,500 kg</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">99</th><td className="p-2">775 kg</td><td className="p-2">1,550 kg</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">100</th><td className="p-2">800 kg</td><td className="p-2">1,600 kg</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">103</th><td className="p-2">875 kg</td><td className="p-2">1,750 kg</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-3">Common tyre speed rating table</h2>
        <p className="mb-3">
          The speed symbol indicates the maximum sustained speed the tyre can safely dissipate heat at under full load:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <caption className="sr-only">Tyre speed symbol conversion table</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="p-2 font-semibold text-ink-1">Speed Symbol</th>
                <th scope="col" className="p-2 font-semibold text-ink-1">Max Speed (mph)</th>
                <th scope="col" className="p-2 font-semibold text-ink-1">Max Speed (km/h)</th>
                <th scope="col" className="p-2 font-semibold text-ink-1">Typical Vehicle Use</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr><th scope="row" className="p-2 font-mono text-brand">T</th><td className="p-2">118 mph</td><td className="p-2">190 km/h</td><td className="p-2">City cars &amp; superminis</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">H</th><td className="p-2">130 mph</td><td className="p-2">210 km/h</td><td className="p-2">Family hatchbacks &amp; MPVs</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">V</th><td className="p-2">149 mph</td><td className="p-2">240 km/h</td><td className="p-2">Executive saloons &amp; modern hatchbacks</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">W</th><td className="p-2">168 mph</td><td className="p-2">270 km/h</td><td className="p-2">High-performance sports sedans</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">Y</th><td className="p-2">186 mph</td><td className="p-2">300 km/h</td><td className="p-2">Supercars &amp; performance EVs</td></tr>
              <tr><th scope="row" className="p-2 font-mono text-brand">(Y)</th><td className="p-2">&gt; 186 mph</td><td className="p-2">&gt; 300 km/h</td><td className="p-2">Ultra-high-performance vehicles</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Can you fit higher or lower ratings?</h2>
        <p className="mb-3">
          <strong className="text-ink-1">Higher ratings are safe:</strong> You can always fit a tyre with a higher load index or speed symbol than your car requires (for example, fitting a 94W tyre when your vehicle requires a 91V).
        </p>
        <p>
          <strong className="text-ink-1">Lower ratings are not permitted:</strong> In the UK, fitting a tyre with a lower load index or speed rating than the manufacturer&apos;s original equipment specification is illegal and could cause an insurance claim to be rejected following an accident.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">What does XL (Extra Load) mean?</h2>
        <p className="mb-3">
          Tyres marked with <strong className="text-ink-1">XL</strong>, <strong className="text-ink-1">Extra Load</strong>, or <strong className="text-ink-1">Reinforced</strong> feature reinforced internal construction. They are engineered to operate at higher inflation pressures (up to 42 psi compared to standard 36 psi) to carry heavier payloads.
        </p>
        <p>
          XL tyres are now standard requirement on modern sport utility vehicles (SUVs), estate cars, and <strong className="text-ink-1">Electric Vehicles (EVs)</strong>, which carry heavy high-voltage battery packs.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Related tyre guides</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <Link href="/guides/tyre-size" className="underline hover:text-ink-1">
              How to read your tyre size (205/55 R16 explained)
            </Link>
          </li>
          <li>
            <Link href="/guides/tyre-replacement-signs" className="underline hover:text-ink-1">
              When should you replace your tyres?
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
