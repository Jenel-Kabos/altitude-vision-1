import { buildMetadata } from '@/lib/seo';
import AltcomServicePage from "@/lib/pages/altcom/AltcomServicePage";
import { SERVICES } from '@/lib/pages/altcom/altcomData';

const SLUG_MAP = {
  'communication-digitale': '1',
  'branding-design':        '2',
  'conseil-strategie':      '3',
  'couverture-mediatique':  '4',
};

const SERVICE_META = {
  'communication-digitale': {
    title:       'Communication Digitale à Brazzaville — Altcom',
    description: 'Altcom, agence de communication digitale à Brazzaville et au Congo : gestion réseaux sociaux, création de contenus, campagnes Meta Ads & Google Ads.',
    keywords:    'communication digitale Brazzaville, agence digitale Congo, réseaux sociaux Brazzaville, Meta Ads Congo, community management Brazzaville',
  },
  'branding-design': {
    title:       'Branding & Design à Brazzaville — Altcom',
    description: "Création de logo, charte graphique et identité visuelle à Brazzaville et dans tout le Congo. Supports print et digitaux professionnels par Altcom.",
    keywords:    'branding Brazzaville, design graphique Congo, création logo Brazzaville, identité visuelle Congo, charte graphique Brazzaville',
  },
  'conseil-strategie': {
    title:       'Conseil & Stratégie Communication à Brazzaville — Altcom',
    description: "Accompagnement stratégique en communication à Brazzaville et au Congo : audit, plan de communication annuel, coaching d'équipes par Altcom.",
    keywords:    'conseil communication Brazzaville, stratégie digitale Congo, audit communication Brazzaville, plan communication Congo, agence conseil Brazzaville',
  },
};

const PROVIDER = {
  '@type':     'LocalBusiness',
  name:        'Altitude Vision — Altcom',
  url:         'https://altitudevision.agency',
  telephone:   '+242068002151',
  address: {
    '@type':         'PostalAddress',
    streetAddress:   'Rue Mfoa n°24, Poto-Poto',
    addressLocality: 'Brazzaville',
    addressCountry:  'CG',
  },
};

export async function generateMetadata({ params }) {
  const { serviceSlug } = await params;
  const meta = SERVICE_META[serviceSlug];
  if (!meta) {
    return buildMetadata({
      title:       'Service — Altcom',
      description: 'Découvrez ce service proposé par Altcom, agence de communication à Brazzaville.',
      url:         `/altcom/${serviceSlug}`,
    });
  }
  return {
    ...buildMetadata({ title: meta.title, description: meta.description, url: `/altcom/${serviceSlug}` }),
    keywords: meta.keywords,
  };
}

export default async function Page({ params }) {
  const { serviceSlug } = await params;
  const serviceId = SLUG_MAP[serviceSlug];
  const service   = SERVICES.find(s => s._id === serviceId);

  const jsonLd = service ? {
    '@context':  'https://schema.org',
    '@type':     'Service',
    name:        service.h1 || service.title,
    provider:    PROVIDER,
    areaServed:  ['Brazzaville', 'Congo', 'République du Congo'],
    description: service.fullDesc,
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <AltcomServicePage />
    </>
  );
}
