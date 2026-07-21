import { buildMetadata } from '@/lib/seo';
import ManageRoomCategoriesPage from '@/lib/pages/dashboard/ManageRoomCategoriesPage';

export const metadata = buildMetadata({ title: 'Catégories de chambres', noIndex: true });

export default function Page() {
  return <ManageRoomCategoriesPage />;
}
