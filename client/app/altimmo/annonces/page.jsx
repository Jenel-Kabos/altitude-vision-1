import { Suspense } from 'react';
import { buildMetadata } from '@/lib/seo';
import AltimmoAnnonces from "@/lib/pages/AltimmoAnnonces";

export const metadata = buildMetadata({
  title: "Annonces immobilières à Brazzaville",
  description: "Parcourez toutes les annonces immobilières d'Altimmo : appartements, maisons, villas à vendre ou à louer à Brazzaville.",
  url: "/altimmo/annonces",
});

export default function Page() {
  return (
    <Suspense>
      <AltimmoAnnonces />
    </Suspense>
  );
}
