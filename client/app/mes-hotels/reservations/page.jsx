import { buildMetadata } from '@/lib/seo';
import MyHotelReservationsPage from '@/lib/pages/dashboard/MyHotelReservationsPage';

export const metadata = buildMetadata({ title: 'Mes réservations', noIndex: true });

export default function Page() {
  return <MyHotelReservationsPage />;
}
