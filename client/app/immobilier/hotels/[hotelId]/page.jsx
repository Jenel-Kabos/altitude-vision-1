import { buildMetadata, SITE_URL } from '@/lib/seo';
import HotelPublicDetailPage from '@/lib/pages/HotelPublicDetailPage';
import JsonLd from '@/lib/components/JsonLd';
import { buildHotelSchema, buildBreadcrumb } from '@/lib/jsonld';

async function getHotel(id) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/hotels/public/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.hotel || null;
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const { hotelId } = await params;
  const hotel = await getHotel(hotelId);
  if (!hotel) return buildMetadata({ title: 'Hôtel — Altimmo', url: `/immobilier/hotels/${hotelId}` });
  const city = hotel.property?.address?.city || 'Brazzaville';
  return buildMetadata({
    title: `${hotel.name} — Hôtel à ${city}`,
    description: hotel.description?.slice(0, 150) || `${hotel.name}, établissement hôtelier à ${city}.`,
    image: hotel.gallery?.[0]?.url || hotel.property?.images?.[0],
    url: `/immobilier/hotels/${hotelId}`,
  });
}

export default async function Page({ params }) {
  const { hotelId } = await params;
  const hotel = await getHotel(hotelId);
  const schemas = [];
  if (hotel) {
    schemas.push(buildHotelSchema({ ...hotel, _id: hotelId }));
    schemas.push(buildBreadcrumb([
      { name: 'Accueil', path: '/' },
      { name: 'Séjourner', path: '/immobilier/sejourner' },
      { name: 'Hôtels', path: '/immobilier/hotels' },
      { name: hotel.name, path: `/immobilier/hotels/${hotelId}` },
    ]));
  }
  return (
    <>
      {schemas.length > 0 && <JsonLd schemas={schemas} />}
      <HotelPublicDetailPage />
    </>
  );
}
