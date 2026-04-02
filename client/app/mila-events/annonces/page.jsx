import { buildMetadata } from '@/lib/seo';
import MilaEventsAnnonces from "@/lib/pages/MilaEventsAnnonces";

export const metadata = buildMetadata({
  title: "Événements à Brazzaville — Mila Events",
  description: "Découvrez tous les événements à venir organisés par Mila Events à Brazzaville.",
  url: "/mila-events/annonces",
});

export default function Page() {
  return <MilaEventsAnnonces />;
}
