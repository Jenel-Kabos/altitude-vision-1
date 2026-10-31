// ALTIMMO-AI-INTEGRATION-02 — couche d'adaptation des formulaires web et mobile vers le moteur IA-03.
//
// Les interfaces envoient des filtres structurés (mêmes clés que la recherche classique et que
// « Affiner avec l'IA » d'AI-01). Ils sont validés ici contre le catalogue fermé de l'analyseur,
// puis traduits en une phrase canonique que l'analyseur déterministe reconnaît : le moteur reste
// l'unique source d'interprétation, de recherche et de classement. Une valeur hors catalogue est
// refusée (jamais transmise ni « devinée ») ; les sentinelles « Tous » / « Toutes » sont ignorées.
const C = require('./catalog');

const FILTER_KEYS = Object.freeze([
  'offerType', 'propertyType', 'accommodationType', 'city', 'arrondissement', 'minPrice', 'maxPrice', 'minBedrooms',
]);
const OFFER_PHRASES = Object.freeze({ vente: 'Achat', location: 'Location', hebergement: 'Séjour' });
const ACCOMMODATION_LABELS = Object.freeze({
  villa_meublee: 'Villa meublée', maison_meublee: 'Maison meublée', appartement_meuble: 'Appartement meublé',
  studio_meuble: 'Studio meublé', residence_meublee: 'Résidence meublée', bungalow: 'Bungalow', hotel: 'Hôtel',
  residence_hoteliere: 'Résidence hôtelière', chambre_hotes: 'Chambre d’hôtes', autre: null,
});
const SENTINEL = /^(tous|toutes|all)$/i;
const MAX_VALUE_LENGTH = 60;
const MAX_BEDROOMS = 20;
const AMOUNT = /^\d{1,12}$/;

const fold = (value) => String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const findIn = (list, value) => list.find((item) => fold(item) === fold(value)) || null;

/**
 * @param {unknown} raw filtres reçus du client
 * @returns {{valid:true, filters:object}|{valid:false}} filtres canoniques (valeurs du catalogue)
 */
function normalizeAssistantFilters(raw) {
  if (raw === undefined) return { valid: true, filters: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false };
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!FILTER_KEYS.includes(key)) return { valid: false };
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string' && typeof value !== 'number') return { valid: false };
    const text = String(value).trim();
    if (!text || SENTINEL.test(text)) continue;
    if (text.length > MAX_VALUE_LENGTH) return { valid: false };
    out[key] = text;
  }
  const filters = {};
  if (out.offerType !== undefined) {
    if (!OFFER_PHRASES[out.offerType]) return { valid: false };
    filters.offerType = out.offerType;
  }
  if (out.propertyType !== undefined) {
    const type = findIn(C.PROPERTY_TYPES, out.propertyType);
    if (!type || filters.offerType === 'hebergement') return { valid: false };
    filters.propertyType = type;
  }
  if (out.accommodationType !== undefined) {
    if (!Object.hasOwn(ACCOMMODATION_LABELS, out.accommodationType) || (filters.offerType && filters.offerType !== 'hebergement')) return { valid: false };
    filters.offerType = 'hebergement';
    filters.accommodationType = out.accommodationType;
  }
  if (out.city !== undefined) {
    const city = findIn(C.CITIES, out.city);
    if (!city) return { valid: false };
    filters.city = city;
  }
  if (out.arrondissement !== undefined) {
    const cities = filters.city ? [filters.city] : Object.keys(C.DISTRICTS);
    const match = cities.map((city) => ({ city, district: findIn(C.DISTRICTS[city] || [], out.arrondissement) })).find((item) => item.district);
    if (!match) return { valid: false };
    filters.city = match.city;
    filters.arrondissement = match.district;
  }
  for (const key of ['minPrice', 'maxPrice']) {
    if (out[key] === undefined) continue;
    if (!AMOUNT.test(out[key]) || Number(out[key]) <= 0 || Number(out[key]) > C.MAX_AMOUNT) return { valid: false };
    filters[key] = Number(out[key]);
  }
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice) return { valid: false };
  if (out.minBedrooms !== undefined) {
    const bedrooms = Number(out.minBedrooms);
    if (!Number.isInteger(bedrooms) || bedrooms < 1 || bedrooms > MAX_BEDROOMS) return { valid: false };
    filters.minBedrooms = bedrooms;
  }
  return { valid: true, filters };
}

/** Phrase canonique reconnue par l'analyseur IA-03 (vérifiée par les tests sur l'analyseur réel). */
function filtersToQuery(filters = {}) {
  const parts = [];
  const offer = OFFER_PHRASES[filters.offerType];
  const type = filters.offerType === 'hebergement' ? ACCOMMODATION_LABELS[filters.accommodationType] : filters.propertyType;
  let head = offer ? (type ? `${offer} ${offer === 'Séjour' ? 'en ' : ''}${type}` : offer) : (type || '');
  const place = [filters.arrondissement, filters.city].filter(Boolean).join(' ');
  if (place) head = head ? `${head} à ${place}` : `À ${place}`;
  if (head) parts.push(head);
  if (filters.minBedrooms) parts.push(`${filters.minBedrooms} chambre${filters.minBedrooms > 1 ? 's' : ''}`);
  if (filters.minPrice && filters.maxPrice) parts.push(`budget entre ${filters.minPrice} et ${filters.maxPrice} FCFA`);
  else if (filters.maxPrice) parts.push(`budget maximum ${filters.maxPrice} FCFA`);
  else if (filters.minPrice) parts.push(`budget minimum ${filters.minPrice} FCFA`);
  return parts.join(', ');
}

/** Requête finale : phrase des filtres puis précisions libres de l'utilisateur. */
function composeAssistantQuery({ filters = {}, text = '' } = {}) {
  return [filtersToQuery(filters), String(text || '').trim()].filter(Boolean).join('. ');
}

module.exports = { FILTER_KEYS, ACCOMMODATION_LABELS, normalizeAssistantFilters, filtersToQuery, composeAssistantQuery };
