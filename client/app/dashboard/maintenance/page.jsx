import { buildMetadata } from '@/lib/seo';
import MaintenanceDashboardPage from '@/lib/pages/dashboard/MaintenanceDashboardPage';

export const metadata = buildMetadata({ title: 'Maintenance', noIndex: true });

export default function Page() {
  return <MaintenanceDashboardPage />;
}
