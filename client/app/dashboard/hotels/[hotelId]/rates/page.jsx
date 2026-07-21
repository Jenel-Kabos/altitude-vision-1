import { buildMetadata } from '@/lib/seo';
import ManageHotelRatesPage from '@/lib/pages/dashboard/ManageHotelRatesPage';

export const metadata = buildMetadata({ title: 'Tarifs par catégorie', noIndex: true });

export default function Page() {
  return <ManageHotelRatesPage />;
}
