import { buildMetadata } from '@/lib/seo';
import CouvertureMediatiquePage from "@/lib/pages/altcom/CouvertureMediatiquePage";

const jsonLd = {
  '@context': 'https://schema.org',
  '@type':    'Service',
  name:       'Couverture Médiatique à Brazzaville',
  provider: {
    '@type':   'LocalBusiness',
    name:      'Altitude Vision — Altcom',
    url:       'https://altitudevision.agency',
    telephone: '+242068002151',
    address: {
      '@type':         'PostalAddress',
      streetAddress:   'Rue Mfoa n°24, Poto-Poto',
      addressLocality: 'Brazzaville',
      addressCountry:  'CG',
    },
  },
  areaServed:  ['Brazzaville', 'Congo', 'République du Congo'],
  description: "Altcom assure la couverture médiatique complète de vos événements à Brazzaville et dans tout le Congo : reportage photo HD, captation vidéo 4K, live streaming et post-production.",
};

export const metadata = {
  ...buildMetadata({
    title:       "Couverture Médiatique à Brazzaville — Altcom",
    description: "Altcom assure la couverture médiatique complète de vos événements à Brazzaville et dans tout le Congo : reportage photo HD, captation vidéo 4K, live streaming et post-production.",
    url:         "/altcom/couverture-mediatique",
  }),
  keywords: 'couverture médiatique Brazzaville, reportage photo événement Congo, vidéaste Brazzaville, live streaming Congo, photographe événementiel Brazzaville',
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CouvertureMediatiquePage />
    </>
  );
}
