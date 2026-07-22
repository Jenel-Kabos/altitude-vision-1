import { buildMetadata } from '@/lib/seo';
import HousekeepingDashboardPage from '@/lib/pages/dashboard/HousekeepingDashboardPage';

export const metadata = buildMetadata({ title: 'Ménage', noIndex: true });

export default function Page() {
  return <HousekeepingDashboardPage />;
}
