// Valeurs exactes du modèle MongoDB — synchronisées avec server/models/Property.js
// et altimmo-app/src/constants/propertyTypes.js

export const PROPERTY_TYPES = [
  { value: 'Appartement',        label: 'Appartement'        },
  { value: 'Appartement meublé', label: 'Appartement meublé' },
  { value: 'Maison',             label: 'Maison'             },
  { value: 'Villa',              label: 'Villa'              },
  { value: 'Terrain',            label: 'Terrain'            },
  { value: 'Parcelle',           label: 'Parcelle'           },
  { value: 'Bureau',             label: 'Bureau'             },
  { value: 'Commerce',           label: 'Commerce'           },
  { value: 'Studio',             label: 'Studio'             },
  { value: 'Entrepôt',           label: 'Entrepôt'           },
];

export const PROPERTY_TYPE_VALUES = PROPERTY_TYPES.map(t => t.value);

// Avec option "Tous" pour les filtres
export const PROPERTY_TYPES_WITH_ALL = [
  { value: 'tous', label: 'Tous les types' },
  ...PROPERTY_TYPES,
];

// Type d'offre — nomenclature canonique `offerType` (audit filtrage Altimmo), reflète
// l'enum MongoDB `Property.status` : 'vente' | 'location' | 'hebergement'.
export const OFFER_TYPES = [
  { value: 'tous',        label: 'Tous' },
  { value: 'vente',       label: 'Vente' },
  { value: 'location',    label: 'Location' },
  { value: 'hebergement', label: 'Hébergement' },
];

// Alias rétrocompatible — conservé pour `PropertiesPage.jsx` (hors périmètre de
// l'harmonisation `/immobilier`+`/immobilier/annonces`, ne pas casser).
export const TRANSACTIONS = OFFER_TYPES;

// Presets budget (identiques au mobile SearchPanel)
export const BUDGET_PRESETS = [
  { label: '< 500K',     min: 0,           max: 500_000      },
  { label: '< 5M',       min: 0,           max: 5_000_000    },
  { label: '5M – 30M',   min: 5_000_000,   max: 30_000_000   },
  { label: '30M – 100M', min: 30_000_000,  max: 100_000_000  },
  { label: '> 100M',     min: 100_000_000, max: 500_000_000  },
];

export const PRICE_MAX = 500_000_000;

export function formatPriceShort(n) {
  if (!n || n === 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Md`;
  if (n >= 1_000_000)     return `${Number.isInteger(n / 1_000_000) ? n / 1_000_000 : (n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)         return `${Math.round(n / 1_000)} K`;
  return String(n);
}

export function parseBudgetInput(text) {
  if (!text || !text.trim()) return null;
  const cleaned = text.trim().replace(/\s/g, '').replace(',', '.').toUpperCase();
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  if (cleaned.endsWith('MRD') || cleaned.endsWith('MD')) return Math.round(num * 1_000_000_000);
  if (cleaned.endsWith('M')) return Math.round(num * 1_000_000);
  if (cleaned.endsWith('K')) return Math.round(num * 1_000);
  return Math.round(num);
}
