import { buildMetadata } from '@/lib/seo';
import AltimmoAssistantGate from '@/lib/components/assistant/AltimmoAssistantGate';
import { pickAssistantFilters } from '@/lib/utils/assistantFilters';

export const metadata = buildMetadata({
  title: 'Assistant immobilier IA Altimmo',
  description: "Découvrez l'assistant immobilier IA Altimmo : recherche conversationnelle, exploration et comparaison des annonces immobilières.",
  url: '/immobilier/assistant',
});

// « Affiner avec l'assistant » : les filtres autorisés de la liste d'annonces sont repris.
// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) : conseiller conversationnel pour les seuls comptes autorisés par le serveur.
export default async function Page({ searchParams }) {
  const params = (await searchParams) || {};
  return <AltimmoAssistantGate initialFilters={pickAssistantFilters(params)} />;
}
