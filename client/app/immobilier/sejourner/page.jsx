import { buildMetadata } from '@/lib/seo';
import SejournerLandingPage from '@/lib/pages/SejournerLandingPage';

export const metadata = buildMetadata({
  title: 'Séjourner — Hébergements meublés au Congo Brazzaville | Altitude-Vision',
  description: 'Appartements, villas, studios meublés et hôtels référencés à Brazzaville — réservez un séjour à la nuitée.',
  url: '/immobilier/sejourner',
});

export default function Page() {
  return <SejournerLandingPage />;
}
