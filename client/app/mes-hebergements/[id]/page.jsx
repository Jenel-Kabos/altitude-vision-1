import AccommodationDetailPage from '@/lib/pages/dashboard/AccommodationDetailPage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Exploitation de la maison meublée', noIndex: true });

export default async function Page({ params }) {
  const { id } = await params;
  return <AccommodationDetailPage accommodationId={id} ownerMode />;
}
