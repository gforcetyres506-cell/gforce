import { Suspense } from 'react';
import BookingWizard from '@/components/booking/BookingWizard';
export default function BookingPage() { return <Suspense fallback={<p role="status">Loading booking…</p>}><BookingWizard /></Suspense>; }
