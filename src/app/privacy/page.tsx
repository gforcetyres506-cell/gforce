import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import MStripe from '@/components/ui/MStripe';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Read how G Force Tyres handles customer information and privacy requests.',
};

export default function PrivacyPage() {
  return (
    <div className="container-g section max-w-3xl">
      <MStripe className="mb-6" />

      <div className="mb-8">
        <p className="label mb-2 text-brand">Legal &amp; Data Protection</p>
        <h1 className="display-1">PRIVACY POLICY</h1>
        <p className="text-xs text-ink-3">Last updated: August 2026 · UK GDPR Compliant</p>
      </div>

      <div className="card space-y-6 text-sm text-ink-2 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink-1 uppercase tracking-wider">1. Who We Are</h2>
          <p>
            G Force Tyres operates precision mobile tyre fitting services across the Greater London area. We are dedicated to maintaining the trust and confidence of our customers.
          </p>
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-base font-bold text-ink-1 uppercase tracking-wider">2. Information We Collect</h2>
          <p>When you book a mobile tyre fitting with us, we collect:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Vehicle registration (VRM) to look up factory OEM tyre fitment and speed ratings.</li>
            <li>Full name, mobile telephone number, and email address for dispatch communication.</li>
            <li>Fitting location address and postcode to navigate our mobile workshop van.</li>
            <li>Payment transaction identifiers (processed securely via Stripe; we never store raw card numbers).</li>
          </ul>
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-base font-bold text-ink-1 uppercase tracking-wider">3. How We Use Your Data</h2>
          <p>
            Your information is used strictly to fulfill your mobile tyre booking, send booking confirmations and calendar invites, dispatch our technician, and process payment.
          </p>
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-base font-bold text-ink-1 uppercase tracking-wider">4. Security &amp; Retention</h2>
          <p>
            We implement strict technical and organizational measures to safeguard your personal data. Data is retained only for as long as necessary to satisfy operational and accounting requirements.
          </p>
        </section>

        <div className="pt-4 border-t border-line flex justify-between items-center">
          <Link href="/" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
