import Link from 'next/link';
import { ContactActions } from '@/components/layout/BusinessContact';
import MStripe from '@/components/ui/MStripe';

export default function NotFound() {
  return (
    <div className="container-g section max-w-2xl">
      <MStripe className="mb-6" />
      <p className="label mb-3">G Force Tyres · 404</p>
      <h1 className="display-1 mb-5">Page not found</h1>
      <p className="text-ink-2 mb-8">That page may have moved. Start a tyre search or return to the homepage.</p>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Link href="/#tyre-finder" className="btn btn-primary" data-critical-action>Find tyres</Link>
        <Link href="/" className="btn btn-secondary">Back to home</Link>
      </div>
      <ContactActions />
    </div>
  );
}
