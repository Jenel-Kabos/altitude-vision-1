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

// Sprint B1 — hébergement indépendant (villas/appartements/studios/maisons/
// chambres d'hôtes/résidences meublées). `accommodation` est le sous-objet
// déjà présent dans la réponse publique de propertyController.getOne
// (rates/capacity/amenities/...) — voir server/controllers/propertyController.js.
export const buildVacationRental = (property, accommodation) => {
  const nightlyRate = (accommodation?.rates || []).find((r) => r.mode === 'nightly');
  return {
    '@context': 'https://schema.org',
    '@type': 'VacationRental',
    name: property.title,
    description: property.description,
    url: `${SITE_URL}/immobilier/property/${property._id || property.id}`,
    image: property.images?.[0] || DEFAULT_IMG,
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.address?.city || 'Brazzaville',
      addressRegion: property.address?.arrondissement || undefined,
      addressCountry: 'CG',
      streetAddress: property.address?.street || '',
    },
    numberOfRooms: property.bedrooms || undefined,
    petsAllowed: accommodation?.rules?.petsAllowed,
    amenityFeature: Object.values(accommodation?.amenities || {}).flat().map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    })),
    containsPlace: {
      '@type': 'Accommodation',
      occupancy: { '@type': 'QuantitativeValue', maxValue: accommodation?.capacity?.maxAdults || undefined },
    },
    offers: nightlyRate
      ? {
          '@type': 'Offer',
          price: nightlyRate.amount,
          priceCurrency: nightlyRate.currency || 'XAF',
          availability: 'https://schema.org/InStock',
        }
      : undefined,
  };
};

// Sprint B2 — domaine Hôtellerie. `hotel` est l'objet retourné par
// GET /api/hotels/public/:id (property peuplé, gallery/hotelServices/
// starRating inclus).
export const buildHotelSchema = (hotel) => ({
  '@context': 'https://schema.org',
  '@type': 'Hotel',
  name: hotel.name,
  description: hotel.description,
  url: `${SITE_URL}/immobilier/hotels/${hotel._id || hotel.id}`,
  image: (hotel.gallery?.length ? hotel.gallery.map((g) => g.url) : hotel.property?.images) || [DEFAULT_IMG],
  starRating: hotel.starRating ? { '@type': 'Rating', ratingValue: hotel.starRating, bestRating: 5 } : undefined,
  telephone: hotel.phone || undefined,
  address: {
    '@type': 'PostalAddress',
    addressLocality: hotel.property?.address?.city || 'Brazzaville',
    addressRegion: hotel.property?.address?.arrondissement || undefined,
    addressCountry: 'CG',
    streetAddress: hotel.property?.address?.street || '',
  },
  amenityFeature: Object.entries(hotel.hotelServices || {})
    .filter(([, v]) => v)
    .map(([name]) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
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
