import { Suspense } from 'react';
import { forbidden } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/admin';
import AdminNav from '@/components/admin/AdminNav';
import BookingWizard from '@/components/booking/BookingWizard';
import TyreFinder from '@/components/booking/TyreFinder';
export default async function PhoneBookingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireAdminPage();
  if (actor.profile.role === 'viewer') forbidden();
  const params = await searchParams;
  return <div className="container-g section min-w-0"><AdminNav /><h1 className="display-2 mb-4">Phone booking</h1>
    <p className="text-sm text-ink-2 mb-6">Use the customer’s actual postcode and sidewall sizes. The same catalogue, prices, fitting availability and reservation transaction apply. Full bank payment awaits manual verification.</p>
    {params.tyre ? <Suspense fallback={<p>Loading booking…</p>}><BookingWizard phoneBooking /></Suspense>
      : <TyreFinder cataloguePath="/admin/bookings/phone/catalogue" />}
  </div>;
}
