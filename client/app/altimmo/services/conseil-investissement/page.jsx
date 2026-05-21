import { buildMetadata, SITE_URL } from '@/lib/seo';
import ConseilInvestissementPage from "@/lib/pages/services/ConseilInvestissementPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title: "Conseil en Investissement Immobilier — Altimmo Brazzaville",
  description: "Nos experts Altimmo vous conseillent pour vos investissements immobiliers à Brazzaville et au Congo. Analyse, rentabilité, accompagnement.",
  url: "/altimmo/services/conseil-investissement",
});

const SCHEMAS = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",  item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Altimmo",  item: `${SITE_URL}/altimmo` },
      { "@type": "ListItem", position: 3, name: "Conseil en Investissement", item: `${SITE_URL}/altimmo/services/conseil-investissement` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Conseil en Investissement Immobilier — Altimmo",
    description: "Conseil en investissement immobilier à Brazzaville : analyse de marché, sélection de biens rentables, accompagnement stratégique.",
    provider: { "@type": "RealEstateAgent", name: "Altimmo — Altitude-Vision", url: `${SITE_URL}/altimmo` },
    areaServed: { "@type": "City", name: "Brazzaville" },
    url: `${SITE_URL}/altimmo/services/conseil-investissement`,
  },
];

export default function Page() {
  return (
    <>
      <JsonLd schemas={SCHEMAS} />
      <ConseilInvestissementPage />
    </>
  );
}
