import { buildMetadata } from '@/lib/seo';
import HotelFinanceDashboardPage from '@/lib/pages/dashboard/HotelFinanceDashboardPage';

export const metadata = buildMetadata({ title: 'Finances hôtelières — Dashboard', noIndex: true });

export default function Page() {
  return <HotelFinanceDashboardPage />;
}
