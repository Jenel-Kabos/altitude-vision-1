import { buildMetadata } from '@/lib/seo';
import ActualitesPage from "@/lib/pages/ActualitesPage";

export const metadata = buildMetadata({
  title: "Actualités — Altitude-Vision",
  description: "Suivez toute l'actualité d'Altitude-Vision : immobilier, événements et communication à Brazzaville.",
  url: "/actualites",
});

export default function Page() {
  return <ActualitesPage />;
}
