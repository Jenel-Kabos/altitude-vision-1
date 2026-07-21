import { buildMetadata } from '@/lib/seo';
import ManageAccommodationsPage from '@/lib/pages/dashboard/ManageAccommodationsPage';

export const metadata = buildMetadata({ title: 'Gestion des hébergements', noIndex: true });

export default function Page() {
  return <ManageAccommodationsPage />;
}
