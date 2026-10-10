import { forbidden } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/admin';
import AdminNav from '@/components/admin/AdminNav';
import BankSettings from '@/components/admin/BankSettings';
import OwnerDataImport from '@/components/admin/OwnerDataImport';

export default async function OwnerDataPage() {
  const actor = await requireAdminPage();
  if (actor.profile.role !== 'owner') forbidden();
  return <div className="container-g section min-w-0">
    <AdminNav />
    <h1 className="display-2 mb-6">Business data</h1>
    <p className="text-sm text-ink-2 mb-5">Registration lookup requires current OneAuto account documentation and sandbox verification. Manual tyre size entry remains available.</p>
    <BankSettings />
    <div className="mt-8"><OwnerDataImport /></div>
  </div>;
}
