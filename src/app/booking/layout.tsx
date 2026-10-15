import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book Your Mobile Tyre Fitting',
  description: 'Choose your tyres, fitting location and appointment, then enter your contact details.',
  robots: { index: false, follow: true },
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
