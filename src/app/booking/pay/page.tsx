import Link from 'next/link';
import MStripe from '@/components/ui/MStripe';
import { ContactActions } from '@/components/layout/BusinessContact';

export default function BookingPayPage() {
  return (
    <div className="container-g section max-w-2xl text-center">
      <MStripe className="mb-6 mx-auto" />
      <h1 className="display-2">Online payments unavailable</h1>
      <p className="mt-3 text-sm text-ink-2">
        We cannot take a payment or confirm a booking here at the moment. Please try again later.
      </p>
      <Link href="/#tyre-finder" className="btn btn-secondary mt-6">Return to tyre finder</Link>
      <ContactActions className="justify-center mt-4" />
    </div>
  );
}
