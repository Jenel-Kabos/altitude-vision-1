import { buildMetadata } from '@/lib/seo';
import ERPDashboardPage from '@/lib/pages/dashboard/ERPDashboardPage';

export const metadata = buildMetadata({ title: "Centre d'Administration Global", noIndex: true });

export default function Page() {
  return <ERPDashboardPage />;
}
