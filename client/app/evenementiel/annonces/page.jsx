import { buildMetadata, SITE_URL } from '@/lib/seo';
import MilaEventsAnnonces from "@/lib/pages/MilaEventsAnnonces";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title:       "Événements à Brazzaville — Mila Events",
  description: "Découvrez toutes les réalisations événementielles de Mila Events à Brazzaville : mariages, galas, conférences et anniversaires.",
  url:         "/evenementiel/annonces",
});

const BREADCRUMB = {
  "@context":     "https://schema.org",
  "@type":        "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil",        item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Événementiel",   item: `${SITE_URL}/evenementiel` },
    { "@type": "ListItem", position: 3, name: "Événements",     item: `${SITE_URL}/evenementiel/annonces` },
  ],
};

export default function Page() {
  return (
    <>
      <JsonLd schemas={[BREADCRUMB]} />
      <MilaEventsAnnonces />
    </>
  );
}
