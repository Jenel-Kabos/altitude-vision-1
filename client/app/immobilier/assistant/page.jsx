import { buildMetadata } from '@/lib/seo';
import AltimmoAssistant from '@/lib/components/assistant/AltimmoAssistant';
import { pickAssistantFilters } from '@/lib/utils/assistantFilters';

// ALTIMMO-AI-INTEGRATION-02 — non indexée tant que l'assistant n'est pas activé par la Direction.
export const metadata = buildMetadata({
  title: 'Trouver mon bien avec l’assistant — Altimmo',
  description: "Achat, location ou hébergement à Brazzaville et Pointe-Noire : l'assistant Altimmo recherche et compare les annonces publiées.",
  url: '/immobilier/assistant',
  noIndex: true,
});

// « Affiner avec l'assistant » : les filtres autorisés de la liste d'annonces sont repris.
export default async function Page({ searchParams }) {
  const params = (await searchParams) || {};
  return <AltimmoAssistant initialFilters={pickAssistantFilters(params)} />;
}
