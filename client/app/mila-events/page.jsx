import { buildMetadata } from '@/lib/seo';
import MilaEventsPage from "@/lib/pages/MilaEventsPage";

export const metadata = buildMetadata({
  title: "Mila Events — Organisation d'Événements à Brazzaville, Congo",
  description: "Mila Events by Altitude-Vision : organisation de mariages, galas, conférences et anniversaires à Brazzaville. Devis gratuit, réponse sous 24h.",
  url: "/mila-events",
  image: "/og-mila.jpg",
});

export default function Page() {
  return <MilaEventsPage />;
}
