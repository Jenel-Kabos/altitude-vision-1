import AccommodationDetailPage from '@/lib/pages/dashboard/AccommodationDetailPage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Gestion de l’hébergement', noIndex: true });

export default async function Page({ params }) {
  const { id } = await params;
  return <AccommodationDetailPage accommodationId={id} />;
}
