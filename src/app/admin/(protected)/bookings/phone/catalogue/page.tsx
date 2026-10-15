import { forbidden } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/admin';
import TyreCatalogue from '@/components/booking/TyreCatalogue';
export default async function PhoneCataloguePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireAdminPage();
  if (actor.profile.role === 'viewer') forbidden();
  return <TyreCatalogue searchParams={searchParams} phoneBooking />;
}
