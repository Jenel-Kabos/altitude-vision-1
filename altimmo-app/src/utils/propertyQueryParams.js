// altimmo-app/src/utils/propertyQueryParams.js — Audit filtrage Altimmo (Web + Mobile)
//
// Point unique de construction des paramètres de requête `/altimmo/search`, réutilisé par
// `ListeAnnoncesScreen` ET `CarteScreen` (auparavant deux implémentations `buildQuery`
// dupliquées et divergentes — l'une envoyait `availability=Disponible`, l'autre non).
// Nomenclature canonique identique au web : offerType, propertyType, accommodationType, city,
// arrondissement, minPrice, maxPrice, page, limit. `statusAdmin`/`availability` ne sont plus
// envoyés : le backend les impose déjà systématiquement côté serveur pour toute route
// publique, les envoyer depuis le client n'avait aucun effet.
//
// Correctif architecture recherche Altimmo (2026-07-25) : `propertyType` et
// `accommodationType` sont mutuellement exclusifs — `propertyType` n'est envoyé QUE si
// `offerType !== 'hebergement'`, `accommodationType` QUE si `offerType === 'hebergement'`
// (jamais les deux, jamais l'un à la place de l'autre). Cible désormais `/altimmo/search`
// (endpoint unifié, même route que le web) au lieu de `/properties` (qui ne peut jamais
// renvoyer un hébergement avec sa vraie catégorie).

export const PRICE_MIN = 0;
export const PRICE_MAX = 500_000_000;

export const DEFAULT_PROPERTY_FILTERS = {
  offerType: 'tous',
  propertyType: 'tous',
  accommodationType: 'tous',
  priceRange: [PRICE_MIN, PRICE_MAX],
  city: 'Toutes',
  arrondissement: 'Tous',
};

/**
 * @param {object} filters — { offerType, propertyType, accommodationType,
 *   priceRange:[min,max], city, arrondissement }
 * @param {{page?: number, limit?: number}} pagination
 * @returns {string} query string prête à être concaténée à `/altimmo/search?`
 */
export function buildPropertyQueryParams(filters, { page, limit } = {}) {
  const params = new URLSearchParams();
  if (page != null) params.set('page', String(page));
  if (limit != null) params.set('limit', String(limit));
  const isHebergement = filters.offerType === 'hebergement';
  if (filters.offerType && filters.offerType !== 'tous') params.set('offerType', filters.offerType);
  if (!isHebergement && filters.propertyType && filters.propertyType !== 'tous') {
    params.set('propertyType', filters.propertyType);
  }
  if (isHebergement && filters.accommodationType && filters.accommodationType !== 'tous') {
    params.set('accommodationType', filters.accommodationType);
  }
  if (filters.city && filters.city !== 'Toutes') params.set('city', filters.city);
  if (filters.arrondissement && filters.arrondissement !== 'Tous') params.set('arrondissement', filters.arrondissement);
  const [min, max] = filters.priceRange || [PRICE_MIN, PRICE_MAX];
  if (min > PRICE_MIN) params.set('minPrice', String(min));
  if (max < PRICE_MAX) params.set('maxPrice', String(max));
  return params.toString();
}
