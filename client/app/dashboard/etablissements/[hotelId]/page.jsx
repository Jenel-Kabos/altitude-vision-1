import HotelDetailPage from '@/lib/pages/dashboard/HotelDetailPage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Centre opérationnel hôtelier', noIndex: true });

export default function EstablishmentDetailPage() {
  return <HotelDetailPage />;
}
