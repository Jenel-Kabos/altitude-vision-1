// altimmo-app/src/utils/propertyQueryParams.js — Audit filtrage Altimmo (Web + Mobile)
//
// Point unique de construction des paramètres de requête `/properties`, réutilisé par
// `ListeAnnoncesScreen` ET `CarteScreen` (auparavant deux implémentations `buildQuery`
// dupliquées et divergentes — l'une envoyait `availability=Disponible`, l'autre non).
// Nomenclature canonique identique au web : offerType, propertyType, city, arrondissement,
// minPrice, maxPrice, page, limit. `statusAdmin`/`availability` ne sont plus envoyés : le
// backend les impose déjà systématiquement côté serveur pour toute route publique
// (`propertyController.getAllProperties`), les envoyer depuis le client n'avait aucun effet
// (silencieusement ignorés) — dette de code supprimée.

export const PRICE_MIN = 0;
export const PRICE_MAX = 500_000_000;

export const DEFAULT_PROPERTY_FILTERS = {
  offerType: 'tous',
  propertyType: 'tous',
  priceRange: [PRICE_MIN, PRICE_MAX],
  city: 'Toutes',
  arrondissement: 'Tous',
};

/**
 * @param {object} filters — { offerType, propertyType, priceRange:[min,max], city, arrondissement }
 * @param {{page?: number, limit?: number}} pagination
 * @returns {string} query string prête à être concaténée à `/properties?`
 */
export function buildPropertyQueryParams(filters, { page, limit } = {}) {
  const params = new URLSearchParams();
  if (page != null) params.set('page', String(page));
  if (limit != null) params.set('limit', String(limit));
  if (filters.offerType && filters.offerType !== 'tous') params.set('offerType', filters.offerType);
  if (filters.propertyType && filters.propertyType !== 'tous') params.set('propertyType', filters.propertyType);
  if (filters.city && filters.city !== 'Toutes') params.set('city', filters.city);
  if (filters.arrondissement && filters.arrondissement !== 'Tous') params.set('arrondissement', filters.arrondissement);
  const [min, max] = filters.priceRange || [PRICE_MIN, PRICE_MAX];
  if (min > PRICE_MIN) params.set('minPrice', String(min));
  if (max < PRICE_MAX) params.set('maxPrice', String(max));
  return params.toString();
}
