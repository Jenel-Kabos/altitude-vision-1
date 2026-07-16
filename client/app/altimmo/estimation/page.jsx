import { buildMetadata, SITE_URL } from "@/lib/seo";
import EstimationPage from "@/lib/pages/EstimationPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title: "Estimation gratuite",
  description:
    "Préparez une demande d’avis de valeur immobilier structurée avec Altimmo.",
  url: "/altimmo/estimation",
});

const SCHEMAS = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Altimmo",
        item: `${SITE_URL}/altimmo`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Estimation gratuite",
        item: `${SITE_URL}/altimmo/estimation`,
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Estimation Immobilière Gratuite — Altimmo",
    description:
      "Assistant guidé pour préparer une demande d’avis de valeur immobilier avec Altimmo.",
    provider: {
      "@type": "RealEstateAgent",
      name: "Altimmo — Altitude-Vision",
      url: `${SITE_URL}/altimmo`,
    },
    areaServed: { "@type": "Country", name: "République du Congo" },
    url: `${SITE_URL}/altimmo/estimation`,
  },
];

export default function Page() {
  return (
    <>
      <JsonLd schemas={SCHEMAS} />
      <EstimationPage />
    </>
  );
}
