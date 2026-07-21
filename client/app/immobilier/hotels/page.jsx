import { buildMetadata } from '@/lib/seo';
import HotelsListingPage from '@/lib/pages/HotelsListingPage';

export const metadata = buildMetadata({
  title: 'Hôtels — Altimmo',
  description: "Découvrez les établissements hôteliers disponibles sur Altimmo : présentation, catégories de chambres, tarifs indicatifs.",
  url: '/immobilier/hotels',
});

export default function Page() {
  return <HotelsListingPage />;
}
