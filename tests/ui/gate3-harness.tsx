// TEST_ONLY_SAFE: renders the actual client components without a production Auth bypass.
import { createRoot } from 'react-dom/client';
import BankBookings from '../../src/components/admin/BankBookings';
import BankSettings from '../../src/components/admin/BankSettings';
import BookingWizard from '../../src/components/booking/BookingWizard';
import AdminWorkspace from '../../src/components/admin/AdminWorkspace';
declare global { interface Window { mountGate3: (kind: string, viewer?: boolean) => void; } }
window.mountGate3 = (kind, viewer = false) => {
  const root = createRoot(document.getElementById('root')!);
  root.render(kind.startsWith('os:') ? <AdminWorkspace resource={kind.slice(3) as 'dashboard'|'bookings'} canOperate={!viewer} isOwner={!viewer} />
    : kind === 'settings' ? <BankSettings /> : kind === 'phone' ? <BookingWizard phoneBooking /> : <BankBookings canOperate={!viewer} />);
};
