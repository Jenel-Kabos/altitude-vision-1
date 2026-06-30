import { buildMetadata, SITE_URL } from '@/lib/seo';
import MilaEventsPage from "@/lib/pages/MilaEventsPage";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title:       "Événementiel à Brazzaville — Mila Events | Altitude-Vision",
  description: "80+ événements réussis à Brazzaville. Mariages, galas, conférences — du premier appel au dernier applaudissement, nous gérons chaque détail pour vous.",
  url:         "/evenementiel",
});

const SCHEMAS = [
  {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",        item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Événementiel",   item: `${SITE_URL}/evenementiel` },
    ],
  },
  {
    "@context":   "https://schema.org",
    "@type":      "EventOrganizer",
    name:          "Mila Events — Altitude-Vision",
    description:   "Organisateur d'événements à Brazzaville : mariages, galas, conférences et cérémonies.",
    url:           `${SITE_URL}/evenementiel`,
    telephone:     "+242 05 330 16 75",
    email:         "Milaevents@altitudevision.agency",
    areaServed:    { "@type": "City", name: "Brazzaville" },
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
      <MilaEventsPage />
    </>
  );
}
