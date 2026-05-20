import { buildMetadata, SITE_URL } from '@/lib/seo';
import AltimmoPage from "@/lib/pages/AltimmoPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title:       "Altimmo — Achat, Vente & Location Immobilière à Brazzaville",
  description: "Altimmo by Altitude-Vision : trouvez des appartements, maisons et villas à vendre ou à louer à Brazzaville, Congo.",
  url:         "/altimmo",
  image:       "/og-altimmo.jpg",
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
