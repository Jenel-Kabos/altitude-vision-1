const C = require('./catalog');
const { classifyAmenity, AMENITY_STATE } = require('../altimmoRankingPolicyService');

const TRANSACTION_OFFER = Object.freeze({ BUY: 'vente', RENT: 'location', STAY: 'hebergement' });
const EXPECTED_PERIOD = Object.freeze({ BUY: 'TOTAL', RENT: 'MONTH', STAY: 'NIGHT' });
const MAX_SEARCH_REQUESTS = 24;
const scalar = (value) => ['string', 'number', 'boolean'].includes(typeof value);
const issue = (code, field, message) => ({ code, field, message });
const known = (value) => value !== undefined && value !== null && value !== '';
const exactState = (actual, expected) => !known(actual) ? 'UNKNOWN' : String(actual).toLowerCase() === String(expected).toLowerCase() ? 'TRUE' : 'FALSE';
function canonicalAmenities(values) {
  if (!Array.isArray(values)) return values;
  return values.map((value) => {
    const folded = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return Object.entries(C.AMENITIES).find(([, aliases]) => aliases.some((alias) => folded === alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))?.[0] || folded;
  });
}

function baseRequest(criteria) {
  const request = {
    offerType: TRANSACTION_OFFER[criteria.transaction],
    sort: '-createdAt', page: '1', limit: '50',
  };
  if (scalar(criteria.location?.city)) request.city = criteria.location.city;
  // IA-03C3 : lu par la source interne seulement (filtre tolérant aux quartiers non renseignés).
  if (scalar(criteria.location?.neighborhood)) request.neighborhood = String(criteria.location.neighborhood);
  if (criteria.budget?.min !== null && criteria.budget?.min !== undefined) request.minPrice = String(criteria.budget.min);
  if (criteria.budget?.max !== null && criteria.budget?.max !== undefined) request.maxPrice = String(criteria.budget.max);
  if (criteria.bedrooms?.min !== null && criteria.bedrooms?.min !== undefined) request.minBedrooms = String(criteria.bedrooms.min);
  if (criteria.bathrooms?.min !== null && criteria.bathrooms?.min !== undefined) request.minBathrooms = String(criteria.bathrooms.min);
  if (criteria.surface?.min !== null && criteria.surface?.min !== undefined) request.minSurface = String(criteria.surface.min);
  return request;
}

function buildAllowedSearchRequests(criteria = {}) {
  const blockingIssues = []; const appliedCriteria = []; const unverifiableCriteria = []; const unsupportedCriteria = [];
  if (!C.TRANSACTIONS.includes(criteria.transaction)) {
    return { requests: [], appliedCriteria, unverifiableCriteria, unsupportedCriteria, blockingIssues: [issue('TRANSACTION_REQUIRED', 'transaction', 'Une transaction valide est requise.')] };
  }
  const expectedPeriod = EXPECTED_PERIOD[criteria.transaction];
  const hasBudget = criteria.budget?.min !== null || criteria.budget?.max !== null;
  const periodCompatible = !hasBudget || !criteria.budget?.period || criteria.budget.period === expectedPeriod;
  if (!periodCompatible) blockingIssues.push(issue('INCOMPATIBLE_BUDGET_PERIOD', 'budget.period', `Période ${expectedPeriod} attendue.`));
  if (criteria.budget?.currency && criteria.budget.currency !== 'XAF') blockingIssues.push(issue('UNSUPPORTED_CURRENCY', 'budget.currency', 'Aucune conversion de devise implicite.'));

  const safe = baseRequest(criteria);
  if (!periodCompatible || criteria.budget?.currency && criteria.budget.currency !== 'XAF') {
    delete safe.minPrice; delete safe.maxPrice;
  }
  const isStay = criteria.transaction === 'STAY';
  const canonicalTypes = (isStay ? criteria.accommodationTypes : criteria.propertyTypes || [])
    .filter((value) => typeof value === 'string' && (isStay ? C.ACCOMMODATION_TYPES : C.PROPERTY_TYPES).includes(value));
  const types = [...new Set(canonicalTypes)];
  const districts = [...new Set((criteria.location?.districts || []).filter((value) => typeof value === 'string'))];
  const typeValues = types.length ? types : [null]; const districtValues = districts.length ? districts : [null];
  const requests = [];
  for (const type of typeValues) for (const district of districtValues) {
    if (requests.length >= MAX_SEARCH_REQUESTS) break;
    requests.push({ ...safe, ...(type ? { [isStay ? 'accommodationType' : 'propertyType']: type } : {}), ...(district ? { arrondissement: district } : {}) });
  }
  if (typeValues.length * districtValues.length > MAX_SEARCH_REQUESTS) unsupportedCriteria.push(issue('REQUEST_COMBINATIONS_TRUNCATED', 'propertyTypes', 'Les combinaisons de critères dépassent la limite interne.'));

  const markApplied = (field, condition) => { if (condition) appliedCriteria.push(field); };
  markApplied('transaction', true); markApplied('type', types.length); markApplied('location.city', Boolean(criteria.location?.city));
  markApplied('location.districts', districts.length); markApplied('budget', hasBudget && periodCompatible && (!criteria.budget.currency || criteria.budget.currency === 'XAF'));
  markApplied('bedrooms.min', criteria.bedrooms?.min !== null); markApplied('bathrooms.min', criteria.bathrooms?.min !== null); markApplied('surface.min', criteria.surface?.min !== null);
  if (criteria.location?.neighborhood) appliedCriteria.push('location.neighborhood');
  if (criteria.location?.radiusMeters) unverifiableCriteria.push(issue('RADIUS_WITHOUT_REFERENCE_COORDINATES', 'location.radiusMeters', 'Rayon non vérifié sans coordonnées de référence gouvernées.'));
  if (criteria.location?.radiusMeters && (!Number.isFinite(criteria.location.radiusMeters) || criteria.location.radiusMeters <= 0 || criteria.location.radiusMeters > 50000)) {
    blockingIssues.push(issue('INVALID_RADIUS', 'location.radiusMeters', 'Le rayon doit être compris entre 1 et 50 000 mètres.'));
  }
  if ((criteria.proximity?.required?.length || 0) + (criteria.proximity?.preferred?.length || 0) > 0) unverifiableCriteria.push(issue('POI_CATALOG_UNAVAILABLE', 'proximity', 'Proximité non vérifiée sans catalogue POI validé.'));
  if (criteria.floors?.min !== null) unsupportedCriteria.push(issue('FLOORS_NOT_SEARCHABLE', 'floors.min', 'Le modèle public ne permet pas ce filtre.'));
  return { requests, appliedCriteria, unverifiableCriteria, unsupportedCriteria, blockingIssues };
}

function evaluateListingConstraints(listing = {}, criteria = {}) {
  const checks = [];
  const add = (field, state) => checks.push({ field, state });
  const budgetActual = criteria.transaction === 'STAY' ? listing.searchPrice : listing.price;
  if (criteria.transaction) add('transaction', exactState(listing.status, TRANSACTION_OFFER[criteria.transaction]));
  if (criteria.propertyTypes?.length) add('propertyTypes', !known(listing.type) ? 'UNKNOWN' : criteria.propertyTypes.includes(listing.type) ? 'TRUE' : 'FALSE');
  if (criteria.accommodationTypes?.length) add('accommodationTypes', !known(listing.accommodationType) ? 'UNKNOWN' : criteria.accommodationTypes.includes(listing.accommodationType) ? 'TRUE' : 'FALSE');
  if (criteria.location?.city) add('location.city', exactState(listing.address?.city, criteria.location.city));
  if (criteria.location?.districts?.length) add('location.districts', !known(listing.address?.arrondissement) ? 'UNKNOWN' : criteria.location.districts.some((x) => String(x).toLowerCase() === String(listing.address.arrondissement).toLowerCase()) ? 'TRUE' : 'FALSE');
  if (criteria.location?.neighborhood) add('location.neighborhood', exactState(listing.address?.neighborhood, criteria.location.neighborhood));
  for (const [field, actual, bound, op] of [
    ['budget.min', budgetActual, criteria.budget?.min, 'min'], ['budget.max', budgetActual, criteria.budget?.max, 'max'],
    ['bedrooms.min', listing.bedrooms, criteria.bedrooms?.min, 'min'], ['bathrooms.min', listing.bathrooms, criteria.bathrooms?.min, 'min'],
    ['surface.min', listing.surface, criteria.surface?.min, 'min'],
  ]) {
    if (bound === null || bound === undefined) continue;
    if (!Number.isFinite(Number(actual))) add(field, 'UNKNOWN');
    else add(field, op === 'min' ? (Number(actual) >= bound ? 'TRUE' : 'FALSE') : (Number(actual) <= bound ? 'TRUE' : 'FALSE'));
  }
  if (criteria.transaction === 'STAY' && (criteria.budget?.min !== null || criteria.budget?.max !== null) && criteria.budget?.currency) {
    add('budget.currency', !known(listing.searchCurrency) ? 'UNKNOWN' : listing.searchCurrency === criteria.budget.currency ? 'TRUE' : 'FALSE');
  }
  const amenities = canonicalAmenities(listing.amenities);
  for (const amenity of criteria.amenities?.required || []) add(`amenities.required.${amenity}`, classifyAmenity(amenities, amenity, { isComplete: listing.amenitiesComplete === true }));
  for (const amenity of criteria.amenities?.excluded || []) {
    const state = classifyAmenity(amenities, amenity, { isComplete: listing.amenitiesComplete === true });
    add(`amenities.excluded.${amenity}`, state === AMENITY_STATE.TRUE ? 'FALSE' : state === AMENITY_STATE.FALSE ? 'TRUE' : 'UNKNOWN');
  }
  if (criteria.stay?.checkIn || criteria.stay?.checkOut) add('stay.availability', listing.availabilityCheck?.checked ? (listing.availabilityCheck.available ? 'TRUE' : 'FALSE') : 'UNKNOWN');
  const requestedAdults = criteria.stay?.adults;
  const requestedChildren = criteria.stay?.children;
  if (requestedAdults !== null || requestedChildren !== null) {
    const maxAdults = listing.capacity?.maxAdults; const maxChildren = listing.capacity?.maxChildren;
    if (!Number.isFinite(maxAdults) || !Number.isFinite(maxChildren)) add('stay.capacity', 'UNKNOWN');
    else add('stay.capacity', (requestedAdults || 0) <= maxAdults && (requestedChildren || 0) <= maxChildren ? 'TRUE' : 'FALSE');
  }
  if (criteria.stay?.rooms !== null) {
    add('stay.rooms', Number.isFinite(listing.roomsAvailable) ? (listing.roomsAvailable >= criteria.stay.rooms ? 'TRUE' : 'FALSE') : 'UNKNOWN');
  }
  if (criteria.stay?.nights !== null && !(criteria.stay?.checkIn || criteria.stay?.checkOut)) {
    if (!Number.isFinite(listing.minimumStay)) add('stay.nights', 'UNKNOWN');
    else add('stay.nights', criteria.stay.nights >= listing.minimumStay && (!Number.isFinite(listing.maximumStay) || criteria.stay.nights <= listing.maximumStay) ? 'TRUE' : 'FALSE');
  }
  const classification = checks.some((x) => x.state === 'FALSE') ? 'REJECT' : checks.some((x) => x.state === 'UNKNOWN') ? 'VERIFY' : 'MATCH';
  return { classification, checks, preferences: [...(criteria.amenities?.preferred || [])] };
}

module.exports = { buildAllowedSearchRequests, evaluateListingConstraints, TRANSACTION_OFFER, EXPECTED_PERIOD, MAX_SEARCH_REQUESTS };
