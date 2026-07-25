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
  { value: 'hotel', label: 'Hôtel', icon: 'business-outline' },
  { value: 'residence_hoteliere', label: 'Résidence hôtelière', icon: 'business-outline' },
  { value: 'autre', label: 'Autre', icon: 'apps-outline' },
];

export const ACCOMMODATION_TYPES_WITH_ALL = [
  { value: 'tous', label: 'Toutes les catégories', icon: 'apps-outline' },
  ...ACCOMMODATION_TYPES,
];
