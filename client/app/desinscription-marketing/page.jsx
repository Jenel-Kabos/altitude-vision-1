import { buildMetadata } from '@/lib/seo';
import MarketingUnsubscribePage from '@/lib/pages/MarketingUnsubscribePage';

export const metadata = buildMetadata({ title: 'Désinscription des communications', noIndex: true });

// MARKETING-CONSENT-1 — cible du lien « Se désinscrire » des e-mails
// promotionnels. Le jeton signé est lu côté serveur et transmis à la page,
// qui demande une confirmation explicite avant l'appel POST (un simple
// préchargement du lien ne désinscrit jamais).
export default async function Page({ searchParams }) {
  const { token } = await searchParams;
  return <MarketingUnsubscribePage token={typeof token === 'string' ? token : ''} />;
}
