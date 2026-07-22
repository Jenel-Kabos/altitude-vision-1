import { buildMetadata } from '@/lib/seo';
import AdminRoomsOverviewPage from '@/lib/pages/dashboard/AdminRoomsOverviewPage';

export const metadata = buildMetadata({ title: 'Chambres — vue globale', noIndex: true });

export default function Page() {
  return <AdminRoomsOverviewPage />;
}
