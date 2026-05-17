import { buildMetadata } from '@/lib/seo';
import AltcomServicePage from "@/lib/pages/altcom/AltcomServicePage";

export async function generateMetadata({ params }) {
  const { serviceSlug } = await params;
  // Les services Altcom sont définis statiquement
  const titles = {
    'identite-visuelle': 'Identité Visuelle — Altcom',
    'campagnes-publicitaires': 'Campagnes Publicitaires — Altcom',
    'production-audiovisuelle': 'Production Audiovisuelle — Altcom',
    'strategie-digitale': 'Stratégie Digitale — Altcom',
    'relations-presse': 'Relations Presse — Altcom',
  };
  return buildMetadata({
    title: titles[serviceSlug] || 'Service — Altcom',
    description: 'Découvrez ce service proposé par Altcom, agence de communication à Brazzaville.',
    url: `/altcom/${serviceSlug}`,
  });
}

export default function Page() {
  return <AltcomServicePage />;
}
