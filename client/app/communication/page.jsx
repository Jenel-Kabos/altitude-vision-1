import { buildMetadata, SITE_URL } from '@/lib/seo';
import AltcomPage from "@/lib/pages/altcom/AltcomPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title:       "Communication & Branding à Brazzaville — Altitude-Vision",
  description: "80 entreprises congolaises accompagnées. Branding, digital, stratégie — une seule agence pour construire votre image et multiplier vos clients à Brazzaville.",
  url:         "/communication",
});

const SCHEMAS = [
  {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",        item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Communication",  item: `${SITE_URL}/communication` },
    ],
  },
  {
    "@context":   "https://schema.org",
    "@type":      "ProfessionalService",
    name:          "Altcom — Altitude-Vision",
    description:   "Agence de communication à Brazzaville : branding, stratégie digitale, publicité et production audiovisuelle.",
    url:           `${SITE_URL}/communication`,
    areaServed:    { "@type": "City", name: "Brazzaville" },
    address: {
      "@type":         "PostalAddress",
      streetAddress:   "24 Rue de Mfoa, Poto-Poto",
      addressLocality: "Brazzaville",
      addressCountry:  "CG",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name:    "Services Altcom",
      itemListElement: [
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Communication Digitale" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Branding & Design" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Campagnes Publicitaires" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Production Audiovisuelle" } },
      ],
    },
  },
];

export default function Page() {
  return (
    <>
      <JsonLd schemas={SCHEMAS} />
      <AltcomPage />
    </>
  );
}
