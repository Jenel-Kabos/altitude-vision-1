// Builders JSON-LD Schema.org pour Next.js (Server Components)
// Usage: import { buildOrganization, buildRealEstateListing, buildEvent } from '@/lib/jsonld';

const SITE_URL = 'https://altitudevision.agency';
const DEFAULT_IMG = `${SITE_URL}/og-default.jpg`;

export const buildOrganization = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Altitude-Vision',
  url: SITE_URL,
  logo: `${SITE_URL}/images/Logo_Altitude1.png`,
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
  sameAs: ['https://www.facebook.com/altitudevision'],
});

export const buildRealEstateListing = (property) => ({
  '@context': 'https://schema.org',
  '@type': 'RealEstateListing',
  name: property.title,
  description: property.description,
  url: `${SITE_URL}/immobilier/property/${property._id || property.id}`,
  image: property.images?.[0] || DEFAULT_IMG,
  datePosted: property.createdAt,
  price: property.price ? `${property.price} XAF` : undefined,
  priceCurrency: 'XAF',
  address: {
    '@type': 'PostalAddress',
    addressLocality: property.address?.city || property.city || 'Brazzaville',
    addressCountry: 'CG',
    streetAddress: property.address?.street || property.address || '',
  },
  offers: property.price
    ? {
        '@type': 'Offer',
        price: property.price,
        priceCurrency: 'XAF',
        availability: 'https://schema.org/InStock',
      }
    : undefined,
});

export const buildEvent = (event) => ({
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: event.title,
  description: event.description,
  url: `${SITE_URL}/evenementiel/event/${event._id || event.id}`,
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

export const buildService = (service) => ({
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

export const buildBreadcrumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: `${SITE_URL}${item.path}`,
  })),
});
