import { buildMetadata } from '@/lib/seo';
import PropertyList from "@/lib/pages/Properties/PropertyList";

export const metadata = buildMetadata({
  title: "Liste des Biens — Altimmo",
  description: "Tous les biens immobiliers disponibles à Brazzaville.",
  url: "/properties/list",
});

export default function Page() {
  return <PropertyList />;
}
