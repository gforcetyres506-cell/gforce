import InformationPage from '@/components/content/InformationPage';
import { publicMetadata } from '@/lib/site';
export const metadata = publicMetadata('/how-it-works', 'How Mobile Tyre Booking Works', 'Understand postcode checks, tyre selection, fitting appointments and manual bank-transfer verification with G Force Tyres Mobile.');
export default function HowPage() {
  return <InformationPage path="/how-it-works" title="How booking works" intro="Check coverage and tyre size, review the available options, then enter the fitting and contact details.">
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">1. Check your postcode and size</h2><p>Use the postcode where the vehicle will be fitted. Enter the tyre size printed on its sidewall. Registration lookup is currently unavailable; manual size entry is the available search method.</p></section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">2. Review tyres, price and appointment</h2><p>Choose from the returned tyre options and available appointments. Review the price breakdown and fitting address. An unavailable price, stock check or appointment prevents the booking from proceeding.</p></section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">3. Follow the bank-transfer instructions</h2><p>When bank-transfer booking is available, the reservation shows the amount, bank details, payment reference and expiry time. A reservation awaiting payment is not a confirmed appointment. Making a transfer does not automatically confirm it.</p></section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">4. Check the recorded booking status</h2><p>Staff must independently verify the bank payment. Keep your private management link to check the status and payment instructions. Do not share that link. Contact us if the status does not reflect your payment; do not assume an email or transfer receipt confirms the fitting.</p></section>
  </InformationPage>;
}
