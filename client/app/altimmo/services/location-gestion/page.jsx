import { buildMetadata, SITE_URL } from '@/lib/seo';
import LocationGestionPage from "@/lib/pages/services/LocationGestionPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title: "Location & Gestion Locative — Altimmo Brazzaville",
  description: "Altimmo gère la location et la gestion locative de vos biens immobiliers à Brazzaville. Tranquillité d'esprit garantie.",
  url: "/altimmo/services/location-gestion",
});

const SCHEMAS = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",  item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Altimmo",  item: `${SITE_URL}/altimmo` },
      { "@type": "ListItem", position: 3, name: "Location & Gestion", item: `${SITE_URL}/altimmo/services/location-gestion` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Location & Gestion Locative — Altimmo",
    description: "Service de location et gestion locative à Brazzaville : mise en location, encaissement de loyers, entretien et suivi locataire.",
    provider: { "@type": "RealEstateAgent", name: "Altimmo — Altitude-Vision", url: `${SITE_URL}/altimmo` },
    areaServed: { "@type": "City", name: "Brazzaville" },
    url: `${SITE_URL}/altimmo/services/location-gestion`,
  },
];

export default function Page() {
  return (
    <>
      <JsonLd schemas={SCHEMAS} />
      <LocationGestionPage />
    </>
  );
}
