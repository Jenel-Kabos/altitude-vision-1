import { buildMetadata } from '@/lib/seo';
import PropertiesPage from "@/lib/pages/Properties/PropertiesPage";

export const metadata = buildMetadata({
  title: "Biens Immobiliers — Altimmo",
  description: "Recherchez parmi tous les biens immobiliers disponibles à Brazzaville.",
  url: "/properties",
});

export default function Page() {
  return <PropertiesPage />;
}
