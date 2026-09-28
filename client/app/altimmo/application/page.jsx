import { buildMetadata, SITE_URL } from '@/lib/seo';
import AltimmoAppPage from '@/lib/pages/AltimmoAppPage';
import JsonLd from '@/lib/components/JsonLd';

export const metadata = buildMetadata({
  title:       'Application Altimmo — Immobilier à Brazzaville simplifié',
  description: "Découvrez Altimmo, l'application immobilière d'Altitude Vision pour rechercher des biens, organiser des visites et accéder aux hébergements à Brazzaville.",
  url:         '/altimmo/application',
});

const SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil',     item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Altimmo',     item: `${SITE_URL}/altimmo` },
      { '@type': 'ListItem', position: 3, name: 'Application', item: `${SITE_URL}/altimmo/application` },
    ],
  },
  {
    '@context':  'https://schema.org',
    '@type':     'MobileApplication',
    name:        'Altimmo',
    description: "Application immobilière d'Altitude Vision dédiée à Brazzaville et au Congo. Recherche de biens, carte des opportunités et accès aux hébergements Mila Hotel.",
    url:         `${SITE_URL}/altimmo/application`,
    applicationCategory: 'BusinessApplication',
  },
];

export default function Page() {
  return (
    <>
      <JsonLd schemas={SCHEMAS} />
      <AltimmoAppPage />
    </>
  );
}
