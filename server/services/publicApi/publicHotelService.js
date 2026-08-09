// API-PUBLIC-1 (Phase 5) — Hôtels exposés publiquement. `PUBLIC_HOTEL_FIELDS`
// et la logique de filtrage par ville reprennent exactement ce que
// `controllers/hotelController.exports.listPublic` fait déjà en production
// (routes `/api/hotels/public*`) — y compris la nécessité de filtrer via
// `populate({match})` plutôt qu'un filtre direct sur `Hotel.find()`, car
// `address.city` vit sur `Property`, pas sur `Hotel` (un filtre direct
// `'property.address.city'` ne fonctionnerait pas sur une référence peuplée).
// Aucune nouvelle règle de sécurité/filtrage inventée, la même discipline
// est simplement étendue à la nouvelle surface versionnée /api/public/v1.
// L'algorithme de disponibilité (Phase 5) réutilise intégralement
// `services/hotelAvailabilityService.getAvailability` — jamais réimplémenté.
const Hotel = require('../../models/Hotel');
const RoomCategory = require('../../models/RoomCategory');
const { getAvailability } = require('../hotelAvailabilityService');
const { buildExactCiRegexFilter } = require('../propertyFilterService');
const { escapeRegex } = require('../../utils/regexEscape');

const PUBLIC_HOTEL_FIELDS = 'name brand description starRating phone email website contact services hotelServices hasRestaurant hasReception gallery property publicationStatus active totalRooms totalCapacity totalBeds minNightlyRate maxNightlyRate currency';
const PUBLIC_PROPERTY_SUBFIELDS = 'title images address statusAdmin availability price';

// TENANT-CORE-1 (Phase 7) — `scopeUserIds` optionnel, même discipline que
// publicPropertyService.js : restreint aux hôtels dont `manager` appartient
// au scope résolu depuis `ApiKey.tenant`, jamais appliqué par défaut.
async function listPublicHotels({ city, ville, search, page = 1, limit = 20 } = {}, { scopeUserIds } = {}) {
  const cityFilter = buildExactCiRegexFilter(city !== undefined ? city : ville);
  const hotelFilter = { publicationStatus: 'publie', active: { $ne: false } };
  if (scopeUserIds) hotelFilter.manager = { $in: [...scopeUserIds] };
  const hotels = await Hotel.find(hotelFilter)
    .select(PUBLIC_HOTEL_FIELDS)
    .populate({
      path: 'property',
      select: PUBLIC_PROPERTY_SUBFIELDS,
      match: {
        statusAdmin: 'Validée',
        availability: 'Disponible',
        ...(cityFilter ? { 'address.city': cityFilter } : {}),
        ...(search ? { title: new RegExp(escapeRegex(search), 'i') } : {}),
      },
    })
    .sort({ publishedAt: -1 })
    .lean();

  const visible = hotels.filter((h) => h.property);
  const total = visible.length;
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const start = (safePage - 1) * safeLimit;
  return { hotels: visible.slice(start, start + safeLimit), total, page: safePage, limit: safeLimit };
}

async function getPublicHotelById(id, { scopeUserIds } = {}) {
  const filter = { _id: id, publicationStatus: 'publie', active: { $ne: false } };
  if (scopeUserIds) filter.manager = { $in: [...scopeUserIds] };
  const hotel = await Hotel.findOne(filter)
    .select(PUBLIC_HOTEL_FIELDS).populate('property', PUBLIC_PROPERTY_SUBFIELDS).lean();
  if (!hotel) return null;
  const categories = await RoomCategory.find({ hotel: id, status: 'actif' }).select('name capacity description').lean();
  return { ...hotel, categories };
}

// Même contrat de sortie que la route interne déjà en production
// (`{available, nights}`) — délibérément minimal, jamais de champ interne
// (totalUnits, blockedUnits…) exposé au public (voir commentaire d'origine
// dans hotelReservationController.getPublicAvailability).
async function getPublicHotelAvailability({ hotelId, roomCategoryId, checkInDate, checkOutDate, roomsCount = 1 }) {
  const hotel = await Hotel.findById(hotelId);
  if (!hotel || hotel.publicationStatus !== 'publie' || hotel.active === false) return null;
  const category = await RoomCategory.findOne({ _id: roomCategoryId, hotel: hotelId, status: 'actif' });
  if (!category) return null;
  const result = await getAvailability({ roomCategoryId, checkInDate, checkOutDate, roomsCount: Number(roomsCount) || 1 });
  return { available: result.available, nights: result.nights.map((n) => ({ date: n.date, available: n.sufficient })) };
}

module.exports = { listPublicHotels, getPublicHotelById, getPublicHotelAvailability, PUBLIC_HOTEL_FIELDS };
