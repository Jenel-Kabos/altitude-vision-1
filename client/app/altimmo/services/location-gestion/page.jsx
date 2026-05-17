import { buildMetadata } from '@/lib/seo';
import LocationGestionPage from "@/lib/pages/services/LocationGestionPage";

export const metadata = buildMetadata({
  title: "Location & Gestion Locative — Altimmo",
  description: "Altimmo gère la location et la gestion locative de vos biens immobiliers à Brazzaville.",
  url: "/altimmo/services/location-gestion",
});

export default function Page() {
  return <LocationGestionPage />;
}
