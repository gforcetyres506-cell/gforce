import PolicyPage from '@/components/content/PolicyPage';
import { utilityMetadata } from '@/lib/site';
export const metadata = utilityMetadata('Terms and Conditions', 'Terms information for G Force Tyres Mobile. Request the full service and payment terms before booking.');
export default function TermsPage() {
  return <PolicyPage title="Terms and conditions"><p>Request the service scope, pricing, payment requirements, fitting-access requirements and applicable terms before proceeding. No additional guarantee or turnaround time is published here.</p></PolicyPage>;
}
