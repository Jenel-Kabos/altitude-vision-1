export const PROPERTY_TYPES = [
  { value: 'Appartement',        label: 'Appartement',         icon: 'business-outline' },
  { value: 'Appartement meublé', label: 'Appartement meublé',  icon: 'bed-outline' },
  { value: 'Maison',             label: 'Maison',              icon: 'home-outline' },
  { value: 'Villa',              label: 'Villa',               icon: 'home-outline' },
  { value: 'Terrain',            label: 'Terrain',             icon: 'map-outline' },
  { value: 'Parcelle',           label: 'Parcelle',            icon: 'map-outline' },
  { value: 'Bureau',             label: 'Bureau',              icon: 'briefcase-outline' },
  { value: 'Commerce',           label: 'Commerce',            icon: 'storefront-outline' },
  { value: 'Studio',             label: 'Studio',              icon: 'bed-outline' },
  { value: 'Entrepôt',           label: 'Entrepôt',            icon: 'cube-outline' },
];

export const PROPERTY_TYPE_VALUES = PROPERTY_TYPES.map(t => t.value);

// Pour les filtres avec option "Tous"
export const PROPERTY_TYPES_WITH_ALL = [
  { value: 'tous', label: 'Tous', icon: 'apps-outline' },
  ...PROPERTY_TYPES,
];

// Type d'offre — nomenclature canonique `offerType` (audit filtrage Altimmo), même contenu
// que client/lib/constants/propertyTypes.js (source de vérité backend : Property.status).
export const OFFER_TYPES = [
  { value: 'vente',       label: 'Vente' },
  { value: 'location',    label: 'Location' },
  { value: 'hebergement', label: 'Hébergement' },
  { value: 'tous',        label: 'Tous' },
];

export const PRICE_MAX = 500_000_000;

// Formate un montant FCFA en notation courte (K / M)
export function formatPriceShort(n) {
  if (!n || n === 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Md`;
  if (n >= 1_000_000)     return `${Number.isInteger(n / 1_000_000) ? n / 1_000_000 : (n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)         return `${Math.round(n / 1_000)} K`;
  return String(n);
}
