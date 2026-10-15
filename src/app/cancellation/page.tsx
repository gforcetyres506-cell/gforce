import PolicyPage from '@/components/content/PolicyPage';
import { utilityMetadata } from '@/lib/site';
export const metadata = utilityMetadata('Cancellations and Refunds', 'Cancellation and refund information for G Force Tyres Mobile. Contact the business for the applicable policy before paying.');
export default function CancellationPage() {
  return <PolicyPage title="Cancellations and refunds"><p>Request the applicable cancellation and rescheduling conditions, any charges, the refund process and expected timing before paying. No cancellation fee or refund deadline is published here.</p></PolicyPage>;
}
