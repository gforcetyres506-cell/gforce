// TEST_ONLY_SAFE: renders the actual client components without a production Auth bypass.
import { createRoot } from 'react-dom/client';
import BankBookings from '../../src/components/admin/BankBookings';
import BankSettings from '../../src/components/admin/BankSettings';
import BookingWizard from '../../src/components/booking/BookingWizard';
declare global { interface Window { mountGate3: (kind: string, viewer?: boolean) => void; } }
window.mountGate3 = (kind, viewer = false) => {
  const root = createRoot(document.getElementById('root')!);
  root.render(kind === 'settings' ? <BankSettings /> : kind === 'phone' ? <BookingWizard phoneBooking /> : <BankBookings canOperate={!viewer} />);
};
