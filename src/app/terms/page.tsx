import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import MStripe from '@/components/ui/MStripe';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Read the G Force Tyres terms and conditions, including service scope and customer responsibilities.',
};

export default function TermsPage() {
  return (
    <div className="container-g section max-w-3xl">
      <MStripe className="mb-6" />

      <div className="mb-8">
        <p className="label mb-2 text-brand">Draft legal content</p>
        <h1 className="display-1">TERMS &amp; CONDITIONS</h1>
        <p className="text-xs text-ink-3">Status: awaiting owner and qualified legal review</p>
      </div>

      <div className="card space-y-6 text-sm text-ink-2 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink-1 uppercase tracking-wider">1. Service scope</h2>
          <p>
            The final agreement must define the services offered, confirmed service zones, exclusions, access requirements and what is included in the displayed price.
          </p>
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-base font-bold text-ink-1 uppercase tracking-wider">2. Customer Responsibilities</h2>
          <p>Potential safe-access requirements to review before approval include:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>The vehicle is parked on a firm, level surface with adequate safe working clearance.</li>
            <li>The locking wheel nut key is present and accessible in the vehicle if locking nuts are installed.</li>
            <li>The tyre size selected matches the actual physical tyre size currently fitted on the vehicle sidewall.</li>
          </ul>
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-base font-bold text-ink-1 uppercase tracking-wider">3. Pricing &amp; Payment</h2>
          <p>
            The approved deposit, remaining balance, supported payment methods and cancellation consequences must be displayed before the customer authorises payment.
          </p>
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-base font-bold text-ink-1 uppercase tracking-wider">4. Workmanship and remedies</h2>
          <p>
            Any workmanship promise, remedy, exclusion or post-fitting instruction requires approved operational and legal wording before publication.
          </p>
        </section>

        <div className="pt-4 border-t border-line">
          <Link href="/" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
