import { buildMetadata, SITE_URL } from '@/lib/seo';
import VenteDeBiensPage from "@/lib/pages/services/VenteDeBiensPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title: "Vente de Biens Immobiliers — Altimmo Congo Brazzaville",
  description: "Confiez la vente de votre bien à Altimmo, votre expert immobilier au Congo Brazzaville. Accompagnement complet, estimation gratuite.",
  url: "/immobilier/services/vente-de-biens",
});

const SCHEMAS = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",          item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Immobilier",       item: `${SITE_URL}/immobilier` },
      { "@type": "ListItem", position: 3, name: "Vente de Biens",   item: `${SITE_URL}/immobilier/services/vente-de-biens` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Vente de Biens Immobiliers — Altimmo",
    description: "Service de vente immobilière au Congo Brazzaville : estimation, mise en marché, négociation et suivi juridique.",
    provider: { "@type": "RealEstateAgent", name: "Altimmo — Altitude-Vision", url: `${SITE_URL}/immobilier` },
    areaServed: { "@type": "Country", name: "République du Congo" },
    url: `${SITE_URL}/immobilier/services/vente-de-biens`,
  },
];

export default function Page() {
  return (
    <>
      <JsonLd schemas={SCHEMAS} />
      <VenteDeBiensPage />
    </>
  );
}
