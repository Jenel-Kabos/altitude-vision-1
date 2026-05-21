import { buildMetadata, SITE_URL } from '@/lib/seo';
import ContactPage from "@/lib/pages/ContactPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title: "Contactez-nous — Altitude-Vision Brazzaville",
  description: "Altitude-Vision — 24 Rue de la Mfoa, Poto-Poto, Brazzaville. Contactez notre équipe pour vos projets immobiliers, événementiels ou de communication.",
  url: "/contact",
});

const SCHEMAS = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Contact", item: `${SITE_URL}/contact` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact — Altitude-Vision",
    url: `${SITE_URL}/contact`,
    mainEntity: {
      "@type": "LocalBusiness",
      name: "Altitude-Vision",
      telephone: "+242 05 330 16 75",
      email: "contact@altitudevision.agency",
      address: {
        "@type": "PostalAddress",
        streetAddress: "24 Rue de Mfoa, Poto-Poto",
        addressLocality: "Brazzaville",
        addressCountry: "CG",
      },
    },
  },
];

export default function Page() {
  return (
    <>
      <JsonLd schemas={SCHEMAS} />
      <ContactPage />
    </>
  );
}
