import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileCheck2, Info } from 'lucide-react';
import MStripe from '@/components/ui/MStripe';

export const metadata: Metadata = {
  title: 'Cancellations and Refunds',
  description: 'Read the current G Force Tyres cancellation and refund information.',
};

export default function CancellationPage() {
  return (
    <div className="container-g section max-w-3xl">
      <MStripe className="mb-6" />

      <div className="mb-8">
        <p className="label mb-2 text-brand">Customer information</p>
        <h1 className="display-1">CANCELLATIONS &amp; REFUNDS</h1>
        <p className="text-sm text-ink-3">The final commercial policy is awaiting owner and legal approval.</p>
      </div>

      <div className="card space-y-6 text-sm text-ink-2 leading-relaxed">
        <div className="p-4 bg-brand/10 border border-brand/30 rounded flex items-start gap-3 text-ink-1">
          <Info size={20} className="text-brand shrink-0 mt-0.5" />
          <div>
            <strong className="block text-brand font-bold mb-1">No real payment is collected by the current preview</strong>
            <span>
              Deposit amounts, cancellation windows, fees and refund timing must not be assumed from development data.
            </span>
          </div>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink-1 uppercase tracking-wider">What the final policy must state</h2>
          <ul className="grid gap-3 pt-2 sm:grid-cols-2">
            {[
              'The exact cancellation and rescheduling windows',
              'Any charge retained after a stated deadline',
              'How an approved refund is requested and processed',
              'The payment provider’s expected refund timing',
            ].map((item) => (
              <li key={item} className="flex gap-2 p-3 bg-surface-3 rounded border border-line text-xs">
                <FileCheck2 size={15} className="mt-0.5 shrink-0 text-brand" /> {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-base font-bold text-ink-1 uppercase tracking-wider">Before production launch</h2>
          <p>
            This page must be replaced with approved wording and a verified contact route. The booking-management flow must also be tested against real payment and refund behavior.
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
