import { buildMetadata } from '@/lib/seo';
import MyHotelReservationsPage from '@/lib/pages/dashboard/MyHotelReservationsPage';

export const metadata = buildMetadata({ title: 'Mes réservations', noIndex: true });

export default async function Page({ searchParams }) {
  const params = await searchParams;
  return <MyHotelReservationsPage initialHotelId={params?.hotelId || ''} />;
}
