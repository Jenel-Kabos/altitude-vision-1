import { Suspense } from 'react';
import { buildMetadata, SITE_URL } from '@/lib/seo';
import AltimmoAnnonces from "@/lib/pages/AltimmoAnnonces";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title:       "Annonces immobilières à Brazzaville — Altimmo",
  description: "Parcourez toutes les annonces immobilières d'Altimmo : appartements, maisons, villas à vendre ou à louer à Brazzaville, Congo.",
  url:         "/altimmo/annonces",
});

const BREADCRUMB = {
  "@context":     "https://schema.org",
  "@type":        "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil",   item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Altimmo",   item: `${SITE_URL}/altimmo` },
    { "@type": "ListItem", position: 3, name: "Annonces",  item: `${SITE_URL}/altimmo/annonces` },
  ],
};

export default function Page() {
  return (
    <>
      <JsonLd schemas={[BREADCRUMB]} />
      <Suspense>
        <AltimmoAnnonces />
      </Suspense>
    </>
  );
}
