import InformationPage from '@/components/content/InformationPage';
import { ContactActions } from '@/components/layout/BusinessContact';
import { getBusinessFacts } from '@/lib/business-entity';
import { publicMetadata } from '@/lib/site';
export const metadata = publicMetadata('/contact', 'Contact G Force Tyres Mobile', 'Contact G Force Tyres Mobile about fitting coverage, tyre selection or an existing booking using the available business contact options.');
export default function ContactPage() {
  const facts = getBusinessFacts();
  return <InformationPage path="/contact" title="Contact G Force Tyres Mobile" intro="Use the available contact options for fitting coverage, tyre questions or help with a booking.">
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">Business contact</h2><ContactActions showNumber />{!facts.contact.phone && !facts.contact.whatsapp && <p>Telephone and WhatsApp contact are currently unavailable. Please check again later.</p>}{facts.email && <a href={`mailto:${facts.email}`} className="inline-flex min-h-11 items-center underline">{facts.email}</a>}</section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">Existing bookings</h2><p>Use your private booking-management link to check the recorded status. Keep the link private and never share bank credentials or payment-card details in a message.</p></section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">Fitting locations and hours</h2><p>{facts.openingHours ?? 'Published opening hours are not available. Do not assume round-the-clock service.'} Check the fitting postcode before booking. No customer-facing premises address is published.</p><p className="mt-2 text-xs text-ink-3">G Force Tyres Mobile is an independent mobile tyre fitting operator. We do not operate drive-in premises and are not affiliated with third-party garages or gforcetyres.co.uk.</p></section>
  </InformationPage>;
}
