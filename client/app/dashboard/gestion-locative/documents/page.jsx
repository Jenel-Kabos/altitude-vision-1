import { buildMetadata } from '@/lib/seo';
import RentalDocumentsPage from '@/lib/pages/dashboard/RentalDocumentsPage';

export const metadata = buildMetadata({ title: 'Documents locatifs', noIndex: true });

export default function Page() {
  return <RentalDocumentsPage />;
}
