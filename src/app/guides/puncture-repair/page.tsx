import Link from 'next/link';
import InformationPage from '@/components/content/InformationPage';
import StructuredData from '@/components/StructuredData';
import { publicMetadata } from '@/lib/site';

export const metadata = publicMetadata(
  '/guides/puncture-repair',
  'Can a Punctured Tyre Be Repaired? BS AU 159 Guide',
  'Find out when a punctured tyre can be legally and safely repaired under British Standard BS AU 159, when replacement is required, and how mobile tyre repair works.'
);

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Can a punctured tyre always be repaired?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Under British Standard BS AU 159, a tyre can only be repaired if the puncture is within the central 60% to 70% of the tread (the minor repair zone), has a damage diameter of 6mm or less, has not been driven on while flat, and the sidewall and internal carcass are undamaged.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can a tyre sidewall puncture be repaired?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Punctures in the tyre sidewall or shoulder can never be legally or safely repaired. The sidewall undergoes continuous high-frequency flexing and carries the vehicle weight. Any puncture in the sidewall creates a blowout risk, so the tyre must be replaced.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why do mobile tyre fitters carry a replacement tyre for a puncture repair?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A tyre must be completely demounted from the wheel rim to inspect the inside casing for run-flat damage, cord separation, or secondary punctures. If internal damage is discovered that makes the tyre unsafe or illegal to repair, having the correct replacement tyre on the van ensures you are not left stranded.',
      },
    },
  ],
};

export default function PunctureRepairGuide() {
  return (
    <InformationPage
      path="/guides/puncture-repair"
      title="Can a punctured tyre be repaired?"
      intro="Whether a punctured tyre can be safely repaired or must be replaced is governed strictly in the UK by British Standard BS AU 159. Learn the exact criteria fitters use to assess damage."
      breadcrumbs={[
        { name: 'Home', path: '/' },
        { name: 'Tyre guides', path: '/guides' },
        { name: 'Puncture repair guide', path: '/guides/puncture-repair' },
      ]}
    >
      <StructuredData data={faqSchema} />

      <p className="text-xs text-ink-3">
        Updated <time dateTime="2026-10-18">18 October 2026</time> &bull; 5 min read
      </p>

      {/* Direct Answer Snippet for AEO */}
      <div className="rounded-lg border border-brand/30 bg-surface-2 p-4 text-ink-1">
        <h2 className="text-base font-bold text-brand mb-1">Direct Answer: When can a puncture be repaired?</h2>
        <p className="text-sm leading-relaxed">
          Under British Standard <strong className="text-brand">BS AU 159</strong>, a tyre puncture can only be repaired if it meets all five legal criteria:
        </p>
        <ol className="list-decimal pl-5 mt-2 space-y-1 text-xs text-ink-2">
          <li>The puncture is located within the <strong className="text-ink-1">central 60% to 70% of the tread</strong>.</li>
          <li>The diameter of the puncture hole is <strong className="text-ink-1">6mm or less</strong> (e.g. nail or screw).</li>
          <li>The tyre has <strong className="text-ink-1">not been driven on while flat</strong> (no inner liner crumb or scorched cords).</li>
          <li>The tyre has at least <strong className="text-ink-1">1.6mm legal tread</strong> remaining across the central three-quarters.</li>
          <li>There is <strong className="text-ink-1">no sidewall damage, bead distortion, or ageing dry rot</strong>.</li>
        </ol>
      </div>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">The British Standard BS AU 159 explained</h2>
        <p className="mb-3">
          In the United Kingdom, tyre repairs must comply with <strong className="text-ink-1">BS AU 159</strong> (&quot;Code of practice for the maintenance and repair of tyres for cars and light vans&quot;). This standard establishes strict guidelines to prevent cataclysmic high-speed blowouts.
        </p>
        <p>
          The standard defines the <strong className="text-ink-1">Minor Repair Area</strong> (often called the T-Zone) as the central 60% to 70% of the tread width. Any damage outside this central band—particularly the shoulder blocks and the sidewall—falls into the non-repairable zone.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Why sidewall punctures can never be repaired</h2>
        <p className="mb-3">
          The sidewall is the most dynamic part of a tyre. It continuously flexes with every wheel revolution, absorbs road shocks, and holds the internal air pressure that supports your vehicle&apos;s weight.
        </p>
        <p>
          Unlike the tread area, which contains heavy steel belts, the sidewall has flexible rayon or polyester cords. A puncture patch cannot bond reliably to this flexing surface and would peel away, creating a sudden and dangerous blowout risk.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Why external &quot;string&quot; plugs are illegal as permanent repairs</h2>
        <p className="mb-3">
          Emergency roadside kits often include sticky rubber strings that are inserted from the outside without demounting the tyre. While these may temporarily plug a leak to reach a workshop, they <strong className="text-ink-1">do not comply with BS AU 159</strong> for permanent use:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-ink-1">No internal inspection:</strong> Without removing the tyre from the wheel rim, it is impossible to see if driving on low pressure created black rubber dust (&quot;crumb&quot;) or severed the steel belt structure inside.
          </li>
          <li>
            <strong className="text-ink-1">No hermetic seal:</strong> A legal repair requires a combination stem-and-patch (&quot;mushroom plug&quot;) installed from the inside out, vulcanised to seal both the tread path and the internal airtight liner.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Run-flat tyres and puncture repairs</h2>
        <p className="mb-3">
          Most major premium tyre manufacturers (including Continental, Goodyear, Pirelli, and Bridgestone) advise <strong className="text-ink-1">against repairing run-flat tyres</strong>.
        </p>
        <p>
          Because run-flats are designed with stiffened, reinforced sidewall inserts to support the car with zero air pressure, internal heat buildup during deflated driving damages the structural integrity of the rubber. Once a run-flat tyre has lost pressure and been driven on, it generally must be replaced.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">How mobile puncture callouts work</h2>
        <p className="mb-3">
          When you arrange a mobile tyre appointment with G Force Tyres Mobile for a suspected puncture, we recommend providing your tyre size during booking so that a compatible replacement tyre can be placed on the van alongside our repair kit.
        </p>
        <p>
          Our mobile technician will demount the wheel and tyre, perform an exhaustive internal and external inspection, and advise you honestly whether a legal BS AU 159 repair is possible or if a replacement is required.
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
              When should you replace your tyres? (Tread limits &amp; age)
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
