import { buildMetadata } from '@/lib/seo';
import MarketingDashboardPage from '@/lib/pages/dashboard/MarketingDashboardPage';

export const metadata = buildMetadata({ title: 'Marketing Automation — Altcom', noIndex: true });

export default function Page() {
  return <MarketingDashboardPage />;
}
