import { buildMetadata, SITE_URL } from '@/lib/seo';
import AltimmoPage from "@/lib/pages/AltimmoPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title:       "Altimmo — Achat, Vente & Location Immobilière à Brazzaville",
  description: "200 familles logées à Brazzaville. Biens vérifiés, prix transparents — achetez, louez ou investissez avec des experts qui connaissent chaque quartier.",
  url:         "/altimmo",
});

const SCHEMAS = [
  {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",  item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Altimmo",  item: `${SITE_URL}/altimmo` },
    ],
  },
  {
    "@context":       "https://schema.org",
    "@type":          "RealEstateAgent",
    name:             "Altimmo — Altitude-Vision",
    description:      "Agence immobilière à Brazzaville : achat, vente, location et conseil en investissement.",
    url:              `${SITE_URL}/altimmo`,
    telephone:        "+242 06 800 21 51",
    areaServed:       { "@type": "City", name: "Brazzaville" },
    address: {
      "@type":         "PostalAddress",
      streetAddress:   "24 Rue de Mfoa, Poto-Poto",
      addressLocality: "Brazzaville",
      addressCountry:  "CG",
    },
  },
];

export default function Page() {
  return (
    <>
      <JsonLd schemas={SCHEMAS} />
      <AltimmoPage />
    </>
  );
}
