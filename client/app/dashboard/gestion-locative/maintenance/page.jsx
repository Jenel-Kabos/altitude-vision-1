import { buildMetadata } from '@/lib/seo';
import RentalMaintenancePage from '@/lib/pages/dashboard/RentalMaintenancePage';

export const metadata = buildMetadata({ title: 'Maintenance', noIndex: true });

export default function Page() {
  return <RentalMaintenancePage />;
}
