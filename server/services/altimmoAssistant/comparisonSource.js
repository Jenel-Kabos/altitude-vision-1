// Source IA-03C2 : résolution individuelle d'annonces sélectionnées, en lecture seule.
// Mêmes gardes marketplace qu'IA-03B (searchSource) : aucun contexte tenant n'élargit la visibilité,
// et une annonce absente, privée ou retirée est simplement omise (le service répond de façon uniforme).
const mongoose = require('mongoose');
const Property = require('../../models/Property');
const Accommodation = require('../../models/Accommodation');
const RatePlan = require('../../models/RatePlan');
const { projectApprovedPublicResource } = require('../commercialPublicationService');

const MAX_IDS = 10;
const PROPERTY_FIELDS = [
  '_id', 'title', 'pole', 'type', 'status', 'price', 'images', 'bedrooms', 'bathrooms', 'surface', 'livingRooms',
  'constructionType', 'amenities', 'availability', 'cautionMultiplicateur', 'isPublished', 'statusAdmin',
  'address.city', 'address.arrondissement', 'address.neighborhood', 'accommodationType', 'approvedPublicSnapshot',
].join(' ');
const ACCOMMODATION_FIELDS = 'property accommodationType occupancyMode furnished capacity minimumStay maximumStay amenities currency approvedPublicSnapshot';

function cheapestByMode(rates) {
  const out = new Map();
  for (const rate of rates) {
    const key = `${rate.accommodation}:${rate.mode}`; const current = out.get(key);
    if (!current || rate.amount < current.amount) out.set(key, rate);
  }
  return out;
}

/**
 * @param {string[]} ids identifiants publics déjà validés par le service
 * @returns {Promise<Array<{id:string,listing:object,accommodation:object|null,rates:object}>>}
 */
async function resolvePublicListings(ids = []) {
  const validIds = [...new Set(ids.map(String))].filter((id) => mongoose.isValidObjectId(id)).slice(0, MAX_IDS);
  if (!validIds.length) return [];
  // find() uniquement : aucune écriture (pas de compteur de vues comme GET /api/properties/:id).
  const properties = await Property.find({
    _id: { $in: validIds }, availability: 'Disponible', statusAdmin: 'Validée', isPublished: true, pole: 'Altimmo',
  }).select(PROPERTY_FIELDS).lean();
  const lodgingIds = properties.filter((item) => item.status === 'hebergement').map((item) => item._id);
  const accommodations = lodgingIds.length
    ? await Accommodation.find({ property: { $in: lodgingIds }, publicationStatus: 'publie', active: { $ne: false } }).select(ACCOMMODATION_FIELDS).lean()
    : [];
  const accommodationByProperty = new Map(accommodations.map((item) => [String(item.property), projectApprovedPublicResource(item)]));
  const rates = accommodations.length
    ? await RatePlan.find({ accommodation: { $in: accommodations.map((item) => item._id) }, active: true, mode: { $in: ['nightly', 'monthly'] } })
      .select('accommodation mode amount currency').lean()
    : [];
  const rateByKey = cheapestByMode(rates);
  const records = [];
  for (const property of properties) {
    const id = String(property._id);
    const accommodation = accommodationByProperty.get(id) || null;
    if (property.status === 'hebergement' && !accommodation) continue;
    const rate = (mode) => {
      const found = accommodation && rateByKey.get(`${accommodation._id}:${mode}`);
      return found ? { amount: found.amount, currency: found.currency } : undefined;
    };
    records.push({
      id, listing: { ...property, id },
      accommodation: accommodation && {
        accommodationType: accommodation.accommodationType, occupancyMode: accommodation.occupancyMode, furnished: accommodation.furnished,
        capacity: accommodation.capacity, minimumStay: accommodation.minimumStay, maximumStay: accommodation.maximumStay,
        amenities: accommodation.amenities, currency: accommodation.currency,
      },
      rates: { nightly: rate('nightly'), monthly: rate('monthly') },
    });
  }
  return records;
}

module.exports = { resolvePublicListings, MAX_IDS };
