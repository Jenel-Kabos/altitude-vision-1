import { buildMetadata } from '@/lib/seo';
import RentalPaymentsPage from '@/lib/pages/dashboard/RentalPaymentsPage';

export const metadata = buildMetadata({ title: 'Paiements locatifs', noIndex: true });

export default function Page() {
  return <RentalPaymentsPage />;
}
