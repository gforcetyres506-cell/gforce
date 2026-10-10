import { requireAdminPage } from '@/lib/auth/admin';
import AdminNav from '@/components/admin/AdminNav';
import BankBookings from '@/components/admin/BankBookings';

export default async function AdminPage() {
  const actor = await requireAdminPage();
  return <div className="container-g section min-w-0"><AdminNav /><h1 className="display-2 mb-6">Bookings and bank payments</h1>
    <BankBookings canOperate={actor.profile.role === 'admin' || actor.profile.role === 'owner'} /></div>;
}
