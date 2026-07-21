import { buildMetadata } from '@/lib/seo';
import AdminHotelReservationsPage from '@/lib/pages/dashboard/AdminHotelReservationsPage';

export const metadata = buildMetadata({ title: 'Réservations hôtelières', noIndex: true });

export default function Page() {
  return <AdminHotelReservationsPage />;
}
