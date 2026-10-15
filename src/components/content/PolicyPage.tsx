import Link from 'next/link';
import MStripe from '@/components/ui/MStripe';
import { ContactActions } from '@/components/layout/BusinessContact';

// An honest unavailable state, not unapproved commercial or legal terms.
// Owner/legal approval is a mandatory release gate, recorded in docs/launch.
export default function PolicyPage({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="container-g section max-w-3xl">
    <MStripe className="mb-6" /><h1 className="display-2 mb-6">{title}</h1>
    <div className="card space-y-5 text-sm text-ink-2 leading-relaxed">
      <p>The full policy is currently unavailable. Please contact G Force Tyres Mobile for this information before making a booking or payment.</p>
      {children}<ContactActions showNumber />
      <Link href="/contact" className="btn btn-secondary">Contact information</Link>
      <Link href="/" className="btn btn-secondary">Return to homepage</Link>
    </div>
  </div>;
}
