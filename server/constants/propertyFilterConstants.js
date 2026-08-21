// server/constants/propertyFilterConstants.js — Audit filtrage Altimmo (Web + Mobile)
//
// Nomenclature canonique unique des paramètres de recherche/filtrage, utilisée par le web,
// le mobile ET l'API (server/services/propertyFilterService.js). Une seule source de vérité
// pour les noms de paramètres et les valeurs autorisées, dérivées des enums réels de
// `server/models/Property.js` (jamais inventées — voir test de parité dédié,
// server/__tests__/propertyFilterConstants.test.js, qui échoue si ce fichier diverge du
// schéma Mongoose).
//
// Ne PAS fusionner ce fichier avec `hotelAccessConstants.js` (domaine différent : gouvernance
// des accès hôteliers, pas recherche/filtrage public de biens).

const CANONICAL_QUERY_PARAMS = {
  OFFER_TYPE: 'offerType',
  PROPERTY_TYPE: 'propertyType',
  ACCOMMODATION_TYPE: 'accommodationType',
  CITY: 'city',
  ARRONDISSEMENT: 'arrondissement',
  MIN_PRICE: 'minPrice',
  MAX_PRICE: 'maxPrice',
  SEARCH: 'search',
  SORT: 'sort',
  PAGE: 'page',
  LIMIT: 'limit',
};

// Alias legacy acceptés en entrée (ancien web/mobile, éventuels clients non mis à jour) —
// convertis vers la nomenclature canonique ci-dessus, jamais utilisés au-delà de la
// normalisation d'entrée (voir propertyFilterService.js §10 mission). Documentés pour
// suppression future une fois la migration des clients confirmée.
const LEGACY_QUERY_PARAM_ALIASES = {
  offerType: ['status', 'transaction', 'listingType'],
  propertyType: ['type'],
  city: ['ville'],
};

// Miroir des enums réels de server/models/Property.js — NE JAMAIS inventer de valeur ici,
// voir test de parité dédié.
const OFFER_TYPES = ['vente', 'location', 'hebergement'];
const PROPERTY_TYPES = [
  'Appartement', 'Appartement meublé', 'Maison', 'Villa',
  'Terrain', 'Parcelle', 'Bureau', 'Commerce', 'Studio', 'Entrepôt',
];

// Miroir de l'enum réel de server/models/Accommodation.js (ACCOMMODATION_TYPES) — utilisé
// UNIQUEMENT quand offerType === 'hebergement' (jamais mélangé avec PROPERTY_TYPES, qui ne
// s'applique qu'à vente/location — correction du gap architectural identifié le 2026-07-25 :
// la recherche « Hébergement » doit interroger Accommodation avec ses vraies catégories,
// jamais Property.type). Voir test de parité dédié.
const ACCOMMODATION_TYPES = [
  'villa_meublee', 'maison_meublee', 'appartement_meuble', 'studio_meuble',
  'residence_meublee', 'bungalow', 'hotel', 'residence_hoteliere', 'chambre_hotes', 'autre',
];

module.exports = {
  CANONICAL_QUERY_PARAMS,
  LEGACY_QUERY_PARAM_ALIASES,
  OFFER_TYPES,
  PROPERTY_TYPES,
  ACCOMMODATION_TYPES,
};
