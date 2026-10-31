const { LEGACY_QUERY_PARAM_ALIASES } = require('../constants/propertyFilterConstants');
const { projectApprovedPublicResource } = require('./commercialPublicationService');

const PUBLIC_MAX_LIMIT = 50;
const PUBLIC_DEFAULT_LIMIT = 10;
const PUBLIC_SEARCH_PARAMS = Object.freeze([
  'offerType', ...LEGACY_QUERY_PARAM_ALIASES.offerType,
  'propertyType', ...LEGACY_QUERY_PARAM_ALIASES.propertyType,
  'accommodationType', 'city', ...LEGACY_QUERY_PARAM_ALIASES.city,
  'arrondissement', 'minPrice', 'maxPrice', 'price',
  'minBedrooms', 'minBathrooms', 'minSurface', 'search', 'sort', 'page', 'limit',
]);
const PUBLIC_PROPERTY_FIELDS = Object.freeze([
  '_id', 'title', 'description', 'pole', 'type', 'status', 'price', 'honoraires', 'fraisVisite', 'images',
  'bedrooms', 'bathrooms', 'surface', 'livingRooms', 'kitchens', 'constructionType', 'amenities', 'availability',
  'cautionMultiplicateur', 'profilsLocataireRecherches', 'documentsRequis', 'isPublished', 'statusAdmin',
  'recommande', 'views', 'shares', 'createdAt', 'updatedAt', 'accommodationType', 'accommodationId', 'hotel', 'hotelServices',
]);
const PUBLIC_ADDRESS_FIELDS = Object.freeze(['neighborhood', 'arrondissement', 'city']);
const PUBLIC_ACCOMMODATION_FIELDS = Object.freeze([
  '_id', 'property', 'accommodationType', 'hotel', 'occupancyMode', 'furnished', 'capacity', 'beds', 'checkInTime',
  'checkOutTime', 'minimumStay', 'maximumStay', 'amenities', 'rules', 'houseRules', 'includedServices', 'gallery',
  'cancellationPolicy', 'securityDeposit', 'cleaningFee', 'currency', 'publicationStatus', 'active', 'publishedAt',
]);
const PUBLIC_RATE_FIELDS = Object.freeze([
  '_id', 'accommodation', 'roomCategory', 'mode', 'rateType', 'amount', 'currency', 'active', 'mealPlan', 'cancellation',
]);

const isScalar = (value) => value !== undefined && value !== null && typeof value !== 'object';
// DATA-READINESS-01 — types attendus par le contrat de l'assistant. Une valeur nulle ou d'un autre
// type (document ancien, saisie vide) est retirée : elle devient « non renseignée », jamais convertie
// ni inventée, et ne fait plus rejeter la réponse entière par la garde de contrat.
const TYPED_FIELDS = Object.freeze({
  string: ['title', 'description', 'pole', 'type', 'status', 'constructionType', 'availability', 'statusAdmin', 'accommodationType'],
  number: ['price', 'honoraires', 'fraisVisite', 'cautionMultiplicateur', 'views', 'shares'],
  boolean: ['isPublished', 'recommande'],
  scalar: ['bedrooms', 'bathrooms', 'surface', 'livingRooms', 'kitchens'],
  scalarList: ['images', 'amenities', 'profilsLocataireRecherches', 'documentsRequis'],
});
const hasType = (kind, value) => {
  if (kind === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (kind === 'scalar') return isScalar(value);
  if (kind === 'scalarList') return Array.isArray(value);
  return typeof value === kind;
};
function dropUntyped(out) {
  for (const [kind, fields] of Object.entries(TYPED_FIELDS)) {
    for (const field of fields) {
      if (out[field] === undefined) continue;
      if (!hasType(kind, out[field])) delete out[field];
      else if (kind === 'scalarList') out[field] = out[field].filter(isScalar);
    }
  }
  for (const field of ['createdAt', 'updatedAt']) if (out[field] !== undefined && !(out[field] instanceof Date) && typeof out[field] !== 'string') delete out[field];
  if (out.hotelServices !== undefined && (!out.hotelServices || typeof out.hotelServices !== 'object' || Array.isArray(out.hotelServices))) delete out.hotelServices;
  return out;
}
const pick = (source, fields) => Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
const refId = (value) => (value && typeof value === 'object' && value._id ? value._id : value);

function sanitizePublicSearchQuery(raw = {}) {
  const clean = {};
  for (const key of PUBLIC_SEARCH_PARAMS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = raw[key];
    if (key === 'price') {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const price = {};
        for (const op of ['gte', 'lte', 'gt', 'lt']) if (isScalar(value[op])) price[op] = String(value[op]);
        if (Object.keys(price).length) clean.price = price;
      }
      continue;
    }
    if (!isScalar(value)) continue;
    clean[key] = key === 'search' ? String(value).trim().slice(0, 100) : String(value).trim();
  }
  const { page, limit } = publicPagination(clean);
  clean.page = String(page);
  clean.limit = String(limit);
  return clean;
}

function publicPagination(query = {}) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(PUBLIC_MAX_LIMIT, Math.max(1, Math.floor(Number(query.limit)) || PUBLIC_DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

function toPublicListing(value, { viewerId = null } = {}) {
  if (!value) return value;
  const plain = value && typeof value.toObject === 'function' ? value.toObject() : value;
  const projected = projectApprovedPublicResource(plain);
  const out = pick(projected, PUBLIC_PROPERTY_FIELDS);
  if (out.hotel) out.hotel = refId(out.hotel);
  dropUntyped(out);
  if (projected.address && typeof projected.address === 'object') {
    out.address = pick(projected.address, PUBLIC_ADDRESS_FIELDS);
    for (const field of PUBLIC_ADDRESS_FIELDS) if (out.address[field] !== undefined && typeof out.address[field] !== 'string') delete out.address[field];
  }
  const likes = Array.isArray(projected.likes) ? projected.likes : [];
  out.likesCount = likes.length;
  if (viewerId) out.likedByMe = likes.some((id) => String(refId(id)) === String(viewerId));
  if (Array.isArray(projected.reviews)) {
    out.reviews = projected.reviews.map((review) => ({ rating: review?.rating ?? null, comment: review?.comment || '', createdAt: review?.createdAt || null }));
  }
  if (out._id) out.id = String(out._id);
  return out;
}

function toPublicRate(value) {
  const plain = value && typeof value.toObject === 'function' ? value.toObject() : (value || {});
  const out = pick(plain, PUBLIC_RATE_FIELDS);
  if (out.accommodation) out.accommodation = refId(out.accommodation);
  if (out.roomCategory) out.roomCategory = refId(out.roomCategory);
  return out;
}

function toPublicAccommodation(value, rates = []) {
  if (!value) return null;
  const plain = value && typeof value.toObject === 'function' ? value.toObject() : value;
  const projected = projectApprovedPublicResource(plain);
  const out = pick(projected, PUBLIC_ACCOMMODATION_FIELDS);
  if (out.property) out.property = refId(out.property);
  if (out.hotel) out.hotel = refId(out.hotel);
  out.rates = rates.map(toPublicRate);
  return out;
}

module.exports = {
  PUBLIC_MAX_LIMIT, PUBLIC_DEFAULT_LIMIT, PUBLIC_SEARCH_PARAMS,
  sanitizePublicSearchQuery, publicPagination, toPublicListing, toPublicAccommodation, toPublicRate,
};
