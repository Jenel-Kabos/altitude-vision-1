// src/components/SEOHead.jsx
// Usage: <SEOHead title="..." description="..." image="..." url="..." type="property|event|service|website" data={...} />
import { Helmet } from 'react-helmet-async';

const SITE_NAME    = 'Altitude-Vision';
const SITE_URL     = 'https://altitudevision.agency';
const DEFAULT_IMG  = 'https://altitudevision.agency/og-default.jpg'; // à créer 1200×630
const TWITTER_HANDLE = '@AltitudeVision';

// ─── JSON-LD Builders ────────────────────────────────────────

const buildOrganization = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Altitude-Vision',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+242-06-800-21-51',
    contactType: 'customer service',
    areaServed: 'CG',
    availableLanguage: 'French',
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rue Mfoa n°24',
    addressLocality: 'Poto-Poto, Brazzaville',
    addressCountry: 'CG',
  },
  sameAs: [
    'https://www.facebook.com/altitudevision',
  ],
});

const buildRealEstateListing = (property) => ({
  '@context': 'https://schema.org',
  '@type': 'RealEstateListing',
  name: property.title,
  description: property.description,
  url: `${SITE_URL}/properties/${property._id || property.id}`,
  image: property.images?.[0] || DEFAULT_IMG,
  datePosted: property.createdAt,
  price: property.price ? `${property.price} XAF` : undefined,
  priceCurrency: 'XAF',
  address: {
    '@type': 'PostalAddress',
    addressLocality: property.city || 'Brazzaville',
    addressCountry: 'CG',
    streetAddress: property.address || '',
  },
  offers: property.price ? {
    '@type': 'Offer',
    price: property.price,
    priceCurrency: 'XAF',
    availability: 'https://schema.org/InStock',
  } : undefined,
});

const buildEvent = (event) => ({
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: event.title,
  description: event.description,
  url: `${SITE_URL}/mila-events/${event._id || event.id}`,
  startDate: event.date || event.startDate,
  endDate: event.endDate || event.date,
  image: event.images?.[0] || DEFAULT_IMG,
  location: {
    '@type': 'Place',
    name: event.venue || 'Brazzaville',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Brazzaville',
      addressCountry: 'CG',
    },
  },
  organizer: {
    '@type': 'Organization',
    name: 'Mila Events — Altitude-Vision',
    url: SITE_URL,
  },
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
});

const buildService = (service) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: service.title,
  description: service.description,
  url: `${SITE_URL}/altcom`,
  provider: {
    '@type': 'Organization',
    name: 'Altcom — Altitude-Vision',
    url: SITE_URL,
  },
  areaServed: { '@type': 'Country', name: 'Congo' },
  serviceType: service.category || 'Communication',
});

const buildBreadcrumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: `${SITE_URL}${item.path}`,
  })),
});

// ─── Component ───────────────────────────────────────────────

/**
 * @param {string}  title        - Titre de la page (sans suffixe site)
 * @param {string}  description  - Description meta (155 chars max)
 * @param {string}  image        - URL absolue de l'image OG (1200×630)
 * @param {string}  url          - Chemin relatif de la page ex: /properties/123
 * @param {string}  type         - 'website' | 'property' | 'event' | 'service'
 * @param {object}  data         - Données structurées (property/event/service object)
 * @param {Array}   breadcrumb   - [{name, path}] pour fil d'Ariane
 * @param {boolean} noIndex      - true pour noindex (pages dashboard, etc.)
 */
const SEOHead = ({
  title,
  description = 'Altitude-Vision — Immobilier, Événementiel et Communication à Brazzaville.',
  image = DEFAULT_IMG,
  url = '',
  type = 'website',
  data = null,
  breadcrumb = null,
  noIndex = false,
}) => {
  const fullTitle  = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Immobilier, Événements & Communication`;
  const canonicalUrl = `${SITE_URL}${url}`;
  const ogImage    = image?.startsWith('http') ? image : `${SITE_URL}${image}`;

  // Choisir le bon JSON-LD selon le type
  const getJsonLd = () => {
    const schemas = [buildOrganization()];
    if (type === 'property' && data) schemas.push(buildRealEstateListing(data));
    if (type === 'event'    && data) schemas.push(buildEvent(data));
    if (type === 'service'  && data) schemas.push(buildService(data));
    if (breadcrumb)                  schemas.push(buildBreadcrumb(breadcrumb));
    return schemas;
  };

  return (
    <Helmet>
      {/* ── Balises essentielles ── */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* ── Open Graph ── */}
      <meta property="og:type"        content={type === 'property' ? 'article' : type === 'event' ? 'event' : 'website'} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image"       content={ogImage} />
      <meta property="og:image:width"  content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url"         content={canonicalUrl} />
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta property="og:locale"      content="fr_CG" />

      {/* ── Twitter Card ── */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:site"        content={TWITTER_HANDLE} />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={ogImage} />

      {/* ── JSON-LD Structured Data ── */}
      {getJsonLd().map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema, null, 0)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEOHead;

/*
─── INTÉGRATION PAR PAGE ──────────────────────────────────────

// HomePage.jsx
<SEOHead
  title="Immobilier, Événements & Communication à Brazzaville"
  description="Altitude-Vision — Trouvez votre bien immobilier, organisez vos événements et boostez votre communication à Brazzaville."
  url="/"
/>

// PropertyDetailPage.jsx
<SEOHead
  title={property.title}
  description={property.description?.slice(0, 155)}
  image={property.images?.[0]}
  url={`/properties/${property._id}`}
  type="property"
  data={property}
  breadcrumb={[
    { name: 'Accueil', path: '/' },
    { name: 'Altimmo', path: '/altimmo' },
    { name: property.title, path: `/properties/${property._id}` },
  ]}
/>

// MilaEventsPage.jsx (liste)
<SEOHead
  title="Mila Events — Événements à Brazzaville"
  description="Découvrez et réservez les meilleurs événements à Brazzaville avec Mila Events."
  url="/mila-events"
  breadcrumb={[{ name: 'Accueil', path: '/' }, { name: 'Mila Events', path: '/mila-events' }]}
/>

// Dashboard (noindex)
<SEOHead title="Dashboard" noIndex={true} />
──────────────────────────────────────────────────────────────
*/