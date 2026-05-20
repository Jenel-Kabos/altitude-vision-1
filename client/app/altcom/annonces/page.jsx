import { Suspense } from 'react';
import { buildMetadata, SITE_URL } from '@/lib/seo';
import AltcomAnnonces from "@/lib/pages/altcom/AltcomAnnonces";
import JsonLd from "@/lib/components/JsonLd";

export const metadata = buildMetadata({
  title:       "Portfolio & Réalisations — Altcom Brazzaville",
  description: "Découvrez les projets et réalisations d'Altcom : branding, communication digitale, campagnes publicitaires et production audiovisuelle à Brazzaville.",
  url:         "/altcom/annonces",
});

const BREADCRUMB = {
  "@context":     "https://schema.org",
  "@type":        "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil",   item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Altcom",    item: `${SITE_URL}/altcom` },
    { "@type": "ListItem", position: 3, name: "Portfolio", item: `${SITE_URL}/altcom/annonces` },
  ],
};

export default function Page() {
  return (
    <>
      <JsonLd schemas={[BREADCRUMB]} />
      <Suspense>
        <AltcomAnnonces />
      </Suspense>
    </>
  );
}
