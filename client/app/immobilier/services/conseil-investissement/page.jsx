import { buildMetadata, SITE_URL } from '@/lib/seo';
import ConseilInvestissementPage from "@/lib/pages/services/ConseilInvestissementPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title: "Conseil en Investissement Immobilier — Altimmo Congo Brazzaville",
  description: "Nos experts Altimmo vous conseillent pour vos investissements immobiliers au Congo Brazzaville. Analyse, rentabilité, accompagnement.",
  url: "/immobilier/services/conseil-investissement",
});

const SCHEMAS = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",                    item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Immobilier",                 item: `${SITE_URL}/immobilier` },
      { "@type": "ListItem", position: 3, name: "Conseil en Investissement",  item: `${SITE_URL}/immobilier/services/conseil-investissement` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Conseil en Investissement Immobilier — Altimmo",
    description: "Conseil en investissement immobilier au Congo Brazzaville : analyse de marché, sélection de biens rentables, accompagnement stratégique.",
    provider: { "@type": "RealEstateAgent", name: "Altimmo — Altitude-Vision", url: `${SITE_URL}/immobilier` },
    areaServed: { "@type": "Country", name: "République du Congo" },
    url: `${SITE_URL}/immobilier/services/conseil-investissement`,
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
