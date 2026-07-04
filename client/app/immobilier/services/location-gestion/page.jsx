import { buildMetadata, SITE_URL } from '@/lib/seo';
import LocationGestionPage from "@/lib/pages/services/LocationGestionPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title: "Location & Gestion Locative — Altimmo Congo Brazzaville",
  description: "Altimmo gère la location et la gestion locative de vos biens immobiliers au Congo Brazzaville. Tranquillité d'esprit garantie.",
  url: "/immobilier/services/location-gestion",
});

const SCHEMAS = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",              item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Immobilier",           item: `${SITE_URL}/immobilier` },
      { "@type": "ListItem", position: 3, name: "Location & Gestion",   item: `${SITE_URL}/immobilier/services/location-gestion` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Location & Gestion Locative — Altimmo",
    description: "Service de location et gestion locative au Congo Brazzaville : mise en location, encaissement de loyers, entretien et suivi locataire.",
    provider: { "@type": "RealEstateAgent", name: "Altimmo — Altitude-Vision", url: `${SITE_URL}/immobilier` },
    areaServed: { "@type": "Country", name: "République du Congo" },
    url: `${SITE_URL}/immobilier/services/location-gestion`,
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
