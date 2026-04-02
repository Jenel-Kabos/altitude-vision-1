import { buildMetadata } from '@/lib/seo';
import VenteDeBiensPage from "@/lib/pages/services/VenteDeBiensPage";

export const metadata = buildMetadata({
  title: "Vente de Biens Immobiliers — Altimmo",
  description: "Confiez la vente de votre bien à Altimmo, votre expert immobilier à Brazzaville.",
  url: "/altimmo/services/vente-de-biens",
});

export default function Page() {
  return <VenteDeBiensPage />;
}
