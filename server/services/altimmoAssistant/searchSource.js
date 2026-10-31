// Source de données IA-03B : paramètres déjà issus de l'adaptateur fermé, puis
// revalidation par les services publics. Aucun contexte tenant/projection client n'entre ici.
const Property = require('../../models/Property');
const Accommodation = require('../../models/Accommodation');
const RatePlan = require('../../models/RatePlan');
const { buildPropertyMongoFilter, buildExactCiRegexFilter, toFiniteNumber } = require('../propertyFilterService');
const { searchPublicAccommodations } = require('../accommodationSearchService');
const publicListing = require('../publicListingService');
const { ACCOMMODATION_TYPES } = require('../../constants/propertyFilterConstants');

function minimumFilter(query, key, field) {
  const value = toFiniteNumber(query[key]);
  return value === undefined ? {} : { [field]: { $gte: value } };
}

async function searchProperties(rawRequest = {}) {
  const query = publicListing.sanitizePublicSearchQuery(rawRequest);
  const { mongoFilter } = buildPropertyMongoFilter(query);
  const filter = {
    availability: 'Disponible', statusAdmin: 'Validée', isPublished: true, pole: 'Altimmo',
    ...mongoFilter,
    ...minimumFilter(query, 'minBedrooms', 'bedrooms'),
    ...minimumFilter(query, 'minBathrooms', 'bathrooms'),
    ...minimumFilter(query, 'minSurface', 'surface'),
  };
  const { page, limit, skip } = publicListing.publicPagination(query);
  const [rows, total] = await Promise.all([
    Property.find(filter).sort({ createdAt: -1, _id: 1 }).skip(skip).limit(limit).lean(),
    Property.countDocuments(filter),
  ]);
  return { properties: rows.map(publicListing.toPublicListing), total, page, limit };
}

async function searchAccommodations(rawRequest = {}) {
  // Property.price n'est pas une preuve de tarif nocturne : le filtre financier
  // est appliqué après lecture d'un RatePlan actif, jamais par ce champ générique.
  const { minPrice: _minPrice, maxPrice: _maxPrice, ...nonFinancialRequest } = rawRequest;
  const result = await searchPublicAccommodations(nonFinancialRequest);
  const ids = result.properties.map((item) => item.accommodationId).filter(Boolean);
  if (!ids.length) return result;
  const [details, rates] = await Promise.all([
    Accommodation.find({ _id: { $in: ids }, publicationStatus: 'publie', active: { $ne: false } })
      .select('_id capacity amenities minimumStay maximumStay currency').lean(),
    RatePlan.find({ accommodation: { $in: ids }, mode: 'nightly', active: true }).select('accommodation amount currency').lean(),
  ]);
  const byId = new Map(details.map((item) => [String(item._id), item]));
  const rateByAccommodation = new Map();
  for (const rate of rates) {
    const key = String(rate.accommodation); const current = rateByAccommodation.get(key);
    if (!current || rate.amount < current.amount) rateByAccommodation.set(key, rate);
  }
  return {
    ...result,
    properties: result.properties.map((item) => {
      const detail = byId.get(String(item.accommodationId));
      const rate = rateByAccommodation.get(String(item.accommodationId));
      const structuredAmenities = detail?.amenities && typeof detail.amenities === 'object'
        ? Object.values(detail.amenities).flat().filter((value) => typeof value === 'string') : [];
      return detail ? {
        ...item, capacity: detail.capacity, minimumStay: detail.minimumStay, maximumStay: detail.maximumStay,
        accommodationCurrency: detail.currency, searchPrice: rate?.amount, searchCurrency: rate?.currency,
        amenities: [...new Set([...(item.amenities || []), ...structuredAmenities])],
      } : item;
    }),
  };
}

// ── IA-03C3 — lecture interne par lots ─────────────────────────────────────
// Curseur « keyset » sur createdAt : une annonce ajoutée ou retirée pendant la lecture ne décale
// pas les lots suivants (pas de saut ni de doublon), contrairement à une pagination par skip.
const MAX_BATCH_SIZE = 250;
const DEFAULT_BATCH_SIZE = 100;
const PUBLIC_GATES = Object.freeze({ availability: 'Disponible', statusAdmin: 'Validée', isPublished: true, pole: 'Altimmo' });
// Projection : champs publics IA-02 et faits nécessaires à l'évaluation — jamais documents, propriétaire, tenant.
const SCAN_PROPERTY_FIELDS = [
  '_id', 'title', 'description', 'pole', 'type', 'status', 'price', 'honoraires', 'fraisVisite', 'images', 'bedrooms', 'bathrooms',
  'surface', 'livingRooms', 'kitchens', 'constructionType', 'amenities', 'availability', 'cautionMultiplicateur',
  'profilsLocataireRecherches', 'documentsRequis', 'isPublished', 'statusAdmin', 'recommande', 'views', 'shares', 'createdAt',
  'updatedAt', 'accommodationType', 'hotel', 'hotelServices', 'likes', 'reviews', 'approvedPublicSnapshot',
  'address.neighborhood', 'address.arrondissement', 'address.city',
].join(' ');

const notNumber = (field) => ({ [field]: { $not: { $type: 'number' } } });

/**
 * Filtre Mongo équivalent à l'évaluation en mémoire d'IA-03B : une valeur absente, vide ou d'un
 * type inattendu reste candidate (UNKNOWN → à vérifier) au lieu d'être éliminée par la base.
 */
function scanPropertyFilter(rawRequest, { lodging }) {
  const query = publicListing.sanitizePublicSearchQuery(rawRequest);
  const { mongoFilter } = buildPropertyMongoFilter(lodging ? { ...query, minPrice: undefined, maxPrice: undefined } : query);
  const { price, 'address.city': city, ...strict } = mongoFilter;
  const and = [{ ...PUBLIC_GATES, ...strict, ...(lodging ? { status: 'hebergement' } : {}) }];
  // La ville a une valeur par défaut mais n'est pas obligatoire : absente = inconnue, pas exclue.
  if (city) and.push({ $or: [{ 'address.city': city }, { 'address.city': { $in: [null, ''] } }] });
  if (price) and.push({ $or: [{ price }, notNumber('price')] });
  for (const [key, field] of [['minBedrooms', 'bedrooms'], ['minBathrooms', 'bathrooms'], ['minSurface', 'surface']]) {
    const value = toFiniteNumber(query[key]);
    if (value !== undefined) and.push({ $or: [{ [field]: { $gte: value } }, notNumber(field)] });
  }
  const neighborhood = typeof rawRequest.neighborhood === 'string' && rawRequest.neighborhood.length <= 80 ? buildExactCiRegexFilter(rawRequest.neighborhood) : null;
  if (neighborhood) and.push({ $or: [{ 'address.neighborhood': neighborhood }, { 'address.neighborhood': { $in: [null, ''] } }, { 'address.neighborhood': { $not: { $type: 'string' } } }] });
  return { $and: and };
}

function batchSizeOf(value) {
  const size = Math.floor(Number(value));
  return Number.isFinite(size) && size > 0 ? Math.min(MAX_BATCH_SIZE, size) : DEFAULT_BATCH_SIZE;
}

/**
 * Lit un lot de Property selon le curseur. Le tri porte sur `createdAt` seul pour rester servi par
 * l'index existant { pole, status, createdAt } (un tri composé avec `_id` imposerait un tri bloquant
 * sur toute la partition). Les annonces de même date déjà lues sont exclues par identifiant.
 * Les annonces sans date (null ou absente) sont lues ensuite, par identifiant.
 */
async function readPropertyBatch(filter, cursor, size) {
  const rows = [];
  if (!cursor || cursor.phase === 'dated') {
    const after = cursor ? [{ createdAt: { $lte: new Date(cursor.createdAt) }, _id: { $nin: cursor.boundary } }] : [];
    const dated = await Property.find({ $and: [filter, { createdAt: { $type: 'date' } }, ...after] })
      .sort({ createdAt: -1 }).limit(size).select(SCAN_PROPERTY_FIELDS).lean();
    rows.push(...dated);
    if (dated.length === size) {
      const lastDate = dated[dated.length - 1].createdAt.getTime();
      const sameDate = dated.filter((row) => row.createdAt.getTime() === lastDate).map((row) => row._id);
      const carried = cursor && new Date(cursor.createdAt).getTime() === lastDate ? cursor.boundary : [];
      return { rows, next: { phase: 'dated', createdAt: new Date(lastDate).toISOString(), boundary: [...carried, ...sameDate] } };
    }
  }
  const remaining = size - rows.length;
  const afterId = cursor?.phase === 'undated' ? [{ _id: { $gt: cursor.id } }] : [];
  const undated = await Property.find({ $and: [filter, { createdAt: null }, ...afterId] })
    .sort({ _id: 1 }).limit(remaining).select(SCAN_PROPERTY_FIELDS).lean();
  rows.push(...undated);
  return { rows, next: undated.length === remaining ? { phase: 'undated', id: undated[undated.length - 1]._id } : null };
}

async function enrichLodgingBatch(rows, rawRequest) {
  if (!rows.length) return [];
  const accommodationType = ACCOMMODATION_TYPES.includes(rawRequest.accommodationType) ? rawRequest.accommodationType : null;
  // Lecture restreinte au lot courant : jamais tout le catalogue des hébergements.
  const accommodations = await Accommodation.find({
    property: { $in: rows.map((row) => row._id) }, publicationStatus: 'publie', active: { $ne: false },
    ...(accommodationType ? { accommodationType } : {}),
  }).select('_id property accommodationType hotel capacity amenities minimumStay maximumStay currency')
    .populate({ path: 'hotel', select: '_id hotelServices' }).lean();
  const byProperty = new Map(accommodations.map((item) => [String(item.property), item]));
  const rates = accommodations.length
    ? await RatePlan.find({ accommodation: { $in: accommodations.map((item) => item._id) }, mode: 'nightly', active: true }).select('accommodation amount currency').lean()
    : [];
  const rateByAccommodation = new Map();
  for (const rate of rates) {
    const key = String(rate.accommodation); const current = rateByAccommodation.get(key);
    if (!current || rate.amount < current.amount) rateByAccommodation.set(key, rate);
  }
  return rows.filter((row) => byProperty.has(String(row._id))).map((row) => {
    const detail = byProperty.get(String(row._id));
    const rate = rateByAccommodation.get(String(detail._id));
    const listing = publicListing.toPublicListing({
      ...row, accommodationType: detail.accommodationType, accommodationId: detail._id,
      hotel: detail.hotel?._id || detail.hotel || null,
      hotelServices: detail.accommodationType === 'hotel' ? (detail.hotel?.hotelServices || {}) : undefined,
    });
    const structuredAmenities = detail.amenities && typeof detail.amenities === 'object'
      ? Object.values(detail.amenities).flat().filter((value) => typeof value === 'string') : [];
    return {
      ...listing, capacity: detail.capacity, minimumStay: detail.minimumStay, maximumStay: detail.maximumStay,
      accommodationCurrency: detail.currency, searchPrice: rate?.amount, searchCurrency: rate?.currency,
      amenities: [...new Set([...(listing.amenities || []), ...structuredAmenities])],
    };
  });
}

/**
 * Point de lecture interne IA-03C3 : un lot borné par appel.
 * @returns {Promise<{items:object[],scanned:number,nextCursor:object|null,total?:number,totalExact?:boolean}>}
 */
async function scanCandidates(rawRequest = {}, { cursor = null, batchSize } = {}) {
  const lodging = rawRequest.offerType === 'hebergement';
  const filter = scanPropertyFilter(rawRequest, { lodging });
  const size = batchSizeOf(batchSize);
  const [{ rows, next }, total] = await Promise.all([
    readPropertyBatch(filter, cursor, size),
    cursor ? Promise.resolve(undefined) : Property.countDocuments(filter),
  ]);
  const items = lodging ? await enrichLodgingBatch(rows, rawRequest) : rows.map(publicListing.toPublicListing);
  // Le total Property d'un hébergement est une borne : la publication Accommodation est vérifiée par lot.
  return { items, scanned: rows.length, nextCursor: next, ...(cursor ? {} : { total, totalExact: !lodging }) };
}

module.exports = { searchProperties, searchAccommodations, scanCandidates, scanPropertyFilter, MAX_BATCH_SIZE, DEFAULT_BATCH_SIZE };
