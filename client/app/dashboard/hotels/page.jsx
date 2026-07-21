import { buildMetadata } from '@/lib/seo';
import ManageHotelsPage from '@/lib/pages/dashboard/ManageHotelsPage';

export const metadata = buildMetadata({ title: 'Établissements hôteliers', noIndex: true });

export default function Page() {
  return <ManageHotelsPage />;
}
