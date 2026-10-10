import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBookingByRef } from '@/lib/db';
import { bookingHeading, hasRecordedDeposit } from '@/lib/booking-state';
import { formatPrice, formatSlotTime } from '@/lib/utils';
import MStripe from '@/components/ui/MStripe';
import { ContactActions } from '@/components/layout/BusinessContact';
import type { BookingWithDetails } from '@/types';

export const dynamic = 'force-dynamic';
export default async function ConfirmationPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  let booking: BookingWithDetails | null;
  try {
    booking = await getBookingByRef(ref);
  } catch {
    return <div className="container-g section max-w-2xl"><h1 className="display-2">Booking service unavailable</h1>
      <p role="alert" className="my-4 text-sm text-ink-2">We cannot check your booking right now. Please try again later.</p>
      <ContactActions /><Link href="/#tyre-finder" className="btn btn-secondary mt-4">Return to tyre finder</Link></div>;
  }
  if (!booking) notFound();
  const paid = hasRecordedDeposit(booking);
  return (
    <div className="container-g section max-w-3xl">
      <MStripe className="mb-6" />
      <h1 className="display-2">{bookingHeading(booking)}</h1>
      <p className="mono my-4">Reference: {booking.booking_ref}</p>
      <div className="card space-y-4">
        <p className="text-sm">Recorded status: {booking.status.replaceAll('_', ' ')}</p>
        <p className="text-sm">{booking.slot ? booking.slot.slot_date + ', ' + formatSlotTime(booking.slot.start_time) + '–' + formatSlotTime(booking.slot.end_time) : 'Fitting time not confirmed'}</p>
        <p className="text-sm">{booking.fitting_address ?? 'Fitting address not provided'} {booking.fitting_postcode}</p>
        <p className="text-sm">{booking.fitter_id ? 'Fitter assignment recorded' : 'Fitter not assigned yet'}</p>
        {booking.items.map((item) => <p className="text-sm" key={item.id}>{item.quantity} × {item.tyre_label}: {formatPrice(item.line_total)}</p>)}
        <p className="text-sm">Order total: {formatPrice(booking.total_amount)}</p>
        <p className="text-sm">{paid ? 'Deposit recorded' : 'Deposit required'}: {formatPrice(booking.deposit_amount)}</p>
        <Link className="btn btn-primary" href={'/manage/' + booking.manage_token}>Manage booking</Link>
        <ContactActions />
      </div>
    </div>
  );
}
