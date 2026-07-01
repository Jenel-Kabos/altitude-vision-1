import { buildMetadata, SITE_URL } from '@/lib/seo';
import AltimmoAppPage from '@/lib/pages/AltimmoAppPage';
import JsonLd from '@/lib/components/JsonLd';

export const metadata = buildMetadata({
  title:       'Application Altimmo — Immobilier à Brazzaville simplifié',
  description: "Découvrez Altimmo, la plateforme immobilière d'Altitude-Vision. Recherchez, comparez et sécurisez vos transactions à Brazzaville depuis n'importe quel appareil.",
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
    '@type':     'WebApplication',
    name:        'Altimmo',
    description: "Plateforme immobilière d'Altitude-Vision dédiée à Brazzaville. Achat, vente et location de biens immobiliers vérifiés.",
    url:         `${SITE_URL}/altimmo`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'XAF' },
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
