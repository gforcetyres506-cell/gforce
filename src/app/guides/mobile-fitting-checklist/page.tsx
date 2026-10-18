import Link from 'next/link';
import InformationPage from '@/components/content/InformationPage';
import StructuredData from '@/components/StructuredData';
import { publicMetadata } from '@/lib/site';

export const metadata = publicMetadata(
  '/guides/mobile-fitting-checklist',
  'Mobile Fitting Checklist: What Happens Before Your Appointment',
  'Prepare for your mobile tyre fitting appointment. Complete customer checklist covering parking space, locking wheel nut key, vehicle access, and bank booking confirmation.'
);

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What do I need to prepare before mobile tyre fitting?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Before the technician arrives, locate your locking wheel nut key and place it on the passenger seat, park your vehicle on firm flat ground with at least 1 metre of clearance around the wheels, ensure vehicle keys are accessible, and have your booking reference ready.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where is the locking wheel nut key usually located?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Locking wheel nut keys are commonly kept in the glove compartment, under the boot carpet near the spare wheel or tyre puncture inflation kit, or in a small side compartment in the luggage area.',
      },
    },
    {
      '@type': 'Question',
      name: 'How are bank-transfer bookings confirmed?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'When choosing bank transfer, you receive exact payment instructions and an invoice snapshot with a unique reference number. Once you initiate the transfer, our administrative team manually matches the receipt against the bank feed. When verified, the appointment is confirmed and tyres are dispatched with the mobile fitter.',
      },
    },
  ],
};

export default function MobileFittingChecklistPage() {
  return (
    <InformationPage
      path="/guides/mobile-fitting-checklist"
      title="Mobile tyre fitting appointment checklist"
      intro="Having your tyres replaced at home or work is fast and convenient. Follow this short preparation checklist to ensure your mobile fitting appointment runs smoothly and safely."
      breadcrumbs={[
        { name: 'Home', path: '/' },
        { name: 'Tyre guides', path: '/guides' },
        { name: 'Mobile fitting checklist', path: '/guides/mobile-fitting-checklist' },
      ]}
    >
      <StructuredData data={faqSchema} />

      <p className="text-xs text-ink-3">
        Updated <time dateTime="2026-10-18">18 October 2026</time> &bull; 4 min read
      </p>

      {/* Direct Answer Snippet for AEO */}
      <div className="rounded-lg border border-brand/30 bg-surface-2 p-4 text-ink-1">
        <h2 className="text-base font-bold text-brand mb-1">Direct Answer: What happens before a mobile fitting appointment?</h2>
        <p className="text-sm leading-relaxed mb-2">
          Before your mobile tyre technician arrives, complete this 4-point checklist:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-ink-2">
          <li><strong className="text-ink-1">1. Locking wheel nut key:</strong> Place it on the passenger seat or front dashboard.</li>
          <li><strong className="text-ink-1">2. Parking space:</strong> Park on firm, flat ground (driveway or permitted bay) with 1m side clearance.</li>
          <li><strong className="text-ink-1">3. Keys available:</strong> Keep vehicle keys nearby so the technician can release the electronic parking brake or turn steering wheels.</li>
          <li><strong className="text-ink-1">4. Payment verified:</strong> If paying via bank transfer, ensure the transfer has been initiated with your booking reference.</li>
        </ul>
      </div>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">1. Finding your locking wheel nut key</h2>
        <p className="mb-3">
          Most modern vehicles with alloy wheels have one anti-theft locking wheel nut per wheel. These cannot be removed with standard sockets without the matching adaptor key.
        </p>
        <p className="mb-2">Common locations where the key is stored:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Inside the glove box or center armrest storage compartment.</li>
          <li>Under the boot floor carpet inside the tyre repair kit bag or spare wheel tool tray.</li>
          <li>In a small side storage net or recessed pocket in the vehicle boot lining.</li>
        </ul>
        <p className="text-xs text-ink-3 mt-2">
          <em>Note:</em> If your locking wheel nut key is lost, stripped, or cracked, please inform us in advance as standard mobile callouts require the matching adaptor.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">2. Parking and ground safety requirements</h2>
        <p className="mb-3">
          To safely jack up your vehicle and operate pneumatic tools, the mobile fitting van requires a safe operating space:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-ink-1">Flat, firm ground:</strong> Tarmac, concrete, or flat paving blocks are ideal. We cannot jack up vehicles on soft turf, grass, unpaved dirt, or steep inclines.</li>
          <li><strong className="text-ink-1">Working clearance:</strong> At least 1 metre of unobstructed clearance around the wheels being serviced.</li>
          <li><strong className="text-ink-1">Van proximity:</strong> The technician&apos;s van carries compressed air lines and balancing equipment, so it needs to park within 5 to 10 metres of your car.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">3. What happens during the appointment?</h2>
        <p className="mb-3">Our mobile fitting van is a fully equipped workshop on wheels. During your appointment, the technician will:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Perform an initial visual inspection of all tyres, wheels, and wheel arches.</li>
          <li>Loosen wheel nuts, jack up the vehicle safely with heavy-duty hydraulic jacks, and remove the wheels.</li>
          <li>Deflate the tyre, break the bead, and demount the old tyre using the onboard electro-hydraulic tyre changer.</li>
          <li>Install a new standard rubber valve stem (or inspect and service TPMS tyre pressure sensor valves).</li>
          <li>Mount the new tyre, inflate to the vehicle manufacturer&apos;s specified pressure, and check bead seating.</li>
          <li>Perform electronic dynamic wheel balancing on the onboard computer balancer to prevent steering vibration.</li>
          <li>Re-mount wheels and hand-tighten nuts with a calibrated torque wrench to the exact manufacturer torque setting.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">4. How bank-transfer bookings are confirmed</h2>
        <p className="mb-3">
          At G Force Tyres Mobile, bank-transfer bookings provide an alternative payment method without needing third-party payment gateways:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-ink-1">Unique booking reference:</strong> When you complete the reservation flow, a dedicated reference number (such as <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">GF-XXXX</code>) and bank details are displayed.
          </li>
          <li>
            <strong className="text-ink-1">Manual bank reconciliation:</strong> We do not mark reservations confirmed automatically without proof. Our administrative team monitors our verified banking channel to reconcile the incoming payment against your exact booking reference.
          </li>
          <li>
            <strong className="text-ink-1">Dispatch &amp; confirmation:</strong> Once the transfer is reconciled, the appointment is locked into our operational schedule and the tyres are loaded onto the dispatch van.
          </li>
        </ul>
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
            <Link href="/guides/tyre-replacement-signs" className="underline hover:text-ink-1">
              When should you replace your tyres?
            </Link>
          </li>
          <li>
            <Link href="/coverage" className="underline hover:text-ink-1">
              Mobile tyre fitting coverage &amp; service locations
            </Link>
          </li>
        </ul>
      </section>
    </InformationPage>
  );
}
