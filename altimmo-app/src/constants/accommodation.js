// altimmo-app/src/constants/accommodation.js — miroir de
// client/lib/constants/accommodation.js (synchronisé avec server/models/Accommodation.js).
// Ne pas ajouter de valeur ici sans l'ajouter d'abord côté schéma serveur.
//
// Correctif architecture recherche Altimmo (2026-07-25) : quand offerType==='hebergement', le
// filtre secondaire mobile doit proposer ces vraies catégories, jamais PROPERTY_TYPES
// (Terrain, Bureau, Commerce, Entrepôt n'ont aucun sens pour un hébergement).

export const ACCOMMODATION_TYPES = [
  { value: 'appartement_meuble', label: 'Appartement meublé', icon: 'bed-outline' },
  { value: 'villa_meublee', label: 'Villa meublée', icon: 'home-outline' },
  { value: 'maison_meublee', label: 'Maison meublée', icon: 'home-outline' },
  { value: 'studio_meuble', label: 'Studio meublé', icon: 'bed-outline' },
  { value: "chambre_hotes", label: "Chambre d'hôtes", icon: 'bed-outline' },
  { value: 'residence_meublee', label: 'Résidence meublée', icon: 'business-outline' },
  { value: 'bungalow', label: 'Bungalow', icon: 'home-outline' },
  { value: 'hotel', label: 'Hôtel', icon: 'business-outline' },
  { value: 'residence_hoteliere', label: 'Résidence hôtelière', icon: 'business-outline' },
  { value: 'autre', label: 'Autre', icon: 'apps-outline' },
];

export const FURNISHED_ACCOMMODATION_TYPES = ACCOMMODATION_TYPES.filter(({ value }) => [
  'villa_meublee', 'maison_meublee', 'appartement_meuble', 'studio_meuble',
  'residence_meublee', 'bungalow',
].includes(value));

export const HOTEL_ACCOMMODATION_TYPES = ACCOMMODATION_TYPES
  .filter(({ value }) => ['hotel', 'residence_hoteliere', 'chambre_hotes', 'autre'].includes(value))
  .map((type) => ({ ...type, label: type.value === 'autre' ? 'Autre établissement' : type.label }));

export const ACCOMMODATION_PROPERTY_TYPE_BY_CATEGORY = Object.freeze({
  villa_meublee: 'Villa',
  maison_meublee: 'Maison',
  appartement_meuble: 'Appartement meublé',
  studio_meuble: 'Studio',
  residence_meublee: 'Appartement meublé',
  bungalow: 'Maison',
});

// Property reste l'ancre commune exigée par l'architecture actuelle. Pour un
// établissement, "Commerce" est la valeur canonique existante la plus fidèle
// dans l'enum Property.type ; la vraie nature hôtelière vit dans Hotel et
// Accommodation.accommodationType, jamais dans ce type technique.
export const HOTEL_PROPERTY_TYPE = 'Commerce';

export const ACCOMMODATION_TYPES_WITH_ALL = [
  { value: 'tous', label: 'Toutes les catégories', icon: 'apps-outline' },
  ...ACCOMMODATION_TYPES,
];
