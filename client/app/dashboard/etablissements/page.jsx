import ManageHotelsPage from '@/lib/pages/dashboard/ManageHotelsPage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Établissements', noIndex: true });

export default function EstablishmentsPage() {
  return <ManageHotelsPage />;
}
