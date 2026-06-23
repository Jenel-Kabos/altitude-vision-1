export const PROPERTY_TYPES = [
  { value: 'Appartement',        label: 'Appartement',         icon: 'business-outline' },
  { value: 'Appartement meublé', label: 'Appartement meublé',  icon: 'bed-outline' },
  { value: 'Maison',             label: 'Maison',              icon: 'home-outline' },
  { value: 'Villa',              label: 'Villa',               icon: 'home-outline' },
  { value: 'Terrain',            label: 'Terrain',             icon: 'map-outline' },
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
