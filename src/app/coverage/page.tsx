import InformationPage from '@/components/content/InformationPage';
import { getBusinessFacts } from '@/lib/business-entity';
import { publicMetadata } from '@/lib/site';

export const metadata = publicMetadata(
  '/coverage',
  'Mobile Tyre Fitting Coverage & Service Areas',
  'Check your postcode for mobile tyre fitting coverage. Discover how G Force Tyres Mobile operates, vehicle parking requirements, and roadside safety guidelines.'
);

export default function CoveragePage() {
  const facts = getBusinessFacts();

  return (
    <InformationPage
      path="/coverage"
      title="Mobile tyre fitting coverage"
      intro="G Force Tyres Mobile brings the tyre workshop directly to your doorstep. Coverage is verified at the start of booking using your vehicle's exact fitting postcode."
    >
      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">How coverage verification works</h2>
        <p>
          Before selecting tyres or appointment slots, enter your full UK postcode in our tyre finder. Our system checks the outward postcode against our active dispatch zones. If your area is covered, you will see real-time tyre availability, transparent pricing, and callout fees (if applicable).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Active service areas</h2>
        {facts.serviceAreas.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1">
            {facts.serviceAreas.map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
        ) : (
          <p>
            We operate a dynamic mobile dispatch model. Rather than making unverified UK-wide coverage claims, coverage is checked in real time via your postcode in our tyre finder. If your location is currently outside our regular zones, please contact us directly to enquire about bespoke dispatch or fleet arrangements.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Vehicle location &amp; parking requirements</h2>
        <p className="mb-3">
          To ensure the safety of our technicians, your vehicle, and the public, mobile tyre fitting requires suitable ground conditions:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-ink-1">Firm, flat, level ground:</strong> The vehicle must be parked on tarmac, concrete, or solid block paving. We cannot safely jack vehicles on soft grass, loose gravel, mud, or steep gradients.
          </li>
          <li>
            <strong className="text-ink-1">Adequate working clearance:</strong> We require at least 1 metre of clear, unobstructed space around the wheels being serviced.
          </li>
          <li>
            <strong className="text-ink-1">Van access:</strong> Our mobile fitting vans carry heavy industrial compressors and computerized wheel balancers. The van must be able to park adjacent to or within close reach of your vehicle.
          </li>
          <li>
            <strong className="text-ink-1">Parking permissions:</strong> If fitting occurs in a permit-controlled zone, private car park, or workplace, please ensure visitor access or parking permits are arranged prior to arrival.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Roadside &amp; motorway safety policy</h2>
        <p>
          Under UK health and safety guidelines, mobile tyre fitting cannot be carried out on the hard shoulder of a live motorway or high-speed dual carriageway without designated emergency impact protection vehicles. If you suffer a tyre blowout on a motorway, please pull into an emergency refuge area or service station, or contact National Highways and an emergency recovery provider to reach a safe location first.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-1 mb-2">Independent business identity</h2>
        <p>
          <strong className="text-ink-1">G Force Tyres Mobile</strong> is an independent mobile tyre fitting specialist. We are completely separate from and not affiliated with <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">gforcetyres.co.uk</code> or static garage premises. All bookings placed on this website are dispatched as a mobile service directly to your vehicle&apos;s location.
        </p>
      </section>
    </InformationPage>
  );
}
