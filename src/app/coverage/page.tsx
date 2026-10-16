import InformationPage from '@/components/content/InformationPage';
import { getBusinessFacts } from '@/lib/business-entity';
import { publicMetadata } from '@/lib/site';
export const metadata = publicMetadata('/coverage', 'Check Mobile Tyre Fitting Coverage', 'Check the fitting postcode before choosing tyres. G Force Tyres Mobile only continues the booking journey for an active service area.');
export default function CoveragePage() {
  const facts = getBusinessFacts();
  return <InformationPage path="/coverage" title="Fitting coverage" intro="Availability depends on the vehicle's fitting postcode. Check the exact location before choosing tyres or an appointment.">
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">Check the vehicle location</h2><p>Use the full postcode in the tyre finder. An active service area must match before you can continue. A postcode match does not guarantee an appointment or stock; those are checked separately.</p></section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">Service areas</h2>{facts.serviceAreas.length ? <ul className="list-disc pl-5">{facts.serviceAreas.map(area => <li key={area}>{area}</li>)}</ul> : <p>A published service-area list is not available. Please use the postcode check or contact us to confirm your location. We do not promise UK-wide coverage.</p>}</section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">If the check is unavailable</h2><p>Please try again later or use an available contact option. An unavailable check does not confirm that a postcode is covered.</p></section>
  </InformationPage>;
}
