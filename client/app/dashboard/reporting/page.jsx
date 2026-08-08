import { buildMetadata } from '@/lib/seo';
import ReportingDashboardPage from '@/lib/pages/dashboard/ReportingDashboardPage';

export const metadata = buildMetadata({ title: 'Centre de Pilotage', noIndex: true });

export default function Page() {
  return <ReportingDashboardPage />;
}
