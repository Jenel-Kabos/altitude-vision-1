import { buildMetadata } from '@/lib/seo';
import HotelDetailPage from '@/lib/pages/dashboard/HotelDetailPage';

export const metadata = buildMetadata({ title: "Détail de l'établissement", noIndex: true });

export default function Page() {
  return <HotelDetailPage />;
}
