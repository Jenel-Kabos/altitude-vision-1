// server/services/hotelService.js — Sprint B2 (domaine Hôtellerie)
//
// Logique métier Hôtel : complétude, publication/suspension, cycle de vie
// (dupliquer/supprimer), synchronisation avec l'Accommodation liée (pour ne
// jamais casser la visibilité publique déjà gouvernée par
// accommodationService.isPubliclyVisible, inchangée). Pattern calqué sur
// accommodationService.js (Sprint B1).

const Property = require('../models/Property');
const Hotel = require('../models/Hotel');
const Accommodation = require('../models/Accommodation');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const { destroyFromCloudinary } = require('../config/cloudinary');
const { createFullAccommodation } = require('./accommodationService');
const logger = require('../utils/logger');

const cleanupImages = (images = []) => Promise.all(images.map((url) => destroyFromCloudinary(url))).catch(() => {});

// ─────────────────────────────────────────────
// Score de complétude dédié Hôtel (Sprint B2)
// Informations 20% / Galerie 20% / Services 20% / Catégories 25% / Tarifs 15%
// ─────────────────────────────────────────────
const HOTEL_COMPLETION_WEIGHTS = {
  informations: 20,
  galerie: 20,
  services: 20,
  categories: 25,
  tarifs: 15,
};

function hasAnyHotelService(hotelServices) {
  if (!hotelServices) return false;
  return Object.values(hotelServices).some(Boolean);
}

/**
 * @param {object} hotel — document Hotel (ou plain object)
 * @param {object} property — Property lié
 * @param {Array} categories — RoomCategory actives de cet hôtel
 * @param {Array} categoryRateCounts — nombre de RatePlan actifs par catégorie (même longueur que categories)
 */
function computeHotelCompletionScore(hotel, property, categories = [], categoryRateCounts = []) {
  const informationsOk = Boolean(hotel?.name)
    && Boolean(hotel?.description)
    && Boolean(hotel?.phone)
    && Boolean(property?.address?.city);

  const galerieOk = (hotel?.gallery?.length || 0) > 0 || (property?.images?.length || 0) >= 3;
  const servicesOk = hasAnyHotelService(hotel?.hotelServices);
  const categoriesOk = categories.length > 0;
  const tarifsOk = categories.length > 0 && categoryRateCounts.every((count) => count > 0);

  const breakdown = {
    informations: informationsOk ? HOTEL_COMPLETION_WEIGHTS.informations : 0,
    galerie: galerieOk ? HOTEL_COMPLETION_WEIGHTS.galerie : 0,
    services: servicesOk ? HOTEL_COMPLETION_WEIGHTS.services : 0,
    categories: categoriesOk ? HOTEL_COMPLETION_WEIGHTS.categories : 0,
    tarifs: tarifsOk ? HOTEL_COMPLETION_WEIGHTS.tarifs : 0,
  };
  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { score, breakdown, complete: score === 100 };
}

/**
 * Best-effort : synchronise l'Accommodation(s) liée(s) à ce Hotel quand son
 * statut change (validation/suspension/désactivation) — pour que la
 * visibilité publique (gouvernée exclusivement par
 * accommodationService.isPubliclyVisible, INCHANGÉE) reste cohérente avec
 * le nouveau cycle de publication propre au domaine Hôtellerie. N'écrase
 * jamais silencieusement un rejet Accommodation indépendant : ne touche que
 * publicationStatus/active, jamais rejectionReason/submittedAt.
 *
 * Contrôle final (audit divergence Hotel↔Accommodation) : cette fonction ne
 * DOIT PAS avaler l'échec en silence côté appelant — elle renvoie désormais
 * `{ ok, matchedCount, modifiedCount }` (ou `{ ok:false, error }`) pour que
 * le contrôleur puisse journaliser explicitement (logAction, visible dans
 * le dashboard) un échec de synchronisation, au lieu du seul log serveur.
 * Le hotelId reste toujours la source de vérité : une désynchronisation ne
 * corrompt jamais le statut Hotel lui-même, elle ne fait que retarder sa
 * propagation vers l'Accommodation adaptateur — récupérable à tout moment
 * via `resyncLinkedAccommodations` (reconciliation manuelle).
 */
async function syncLinkedAccommodations(hotelId, { publicationStatus, active } = {}) {
  const update = {};
  if (publicationStatus !== undefined) update.publicationStatus = publicationStatus;
  if (active !== undefined) update.active = active;
  if (Object.keys(update).length === 0) return { ok: true, matchedCount: 0, modifiedCount: 0 };
  try {
    const result = await Accommodation.updateMany({ hotel: hotelId }, { $set: update });
    return { ok: true, matchedCount: result.matchedCount ?? result.n ?? 0, modifiedCount: result.modifiedCount ?? result.nModified ?? 0 };
  } catch (err) {
    logger.error(`Synchronisation Accommodation← Hotel(${hotelId}) échouée`, err);
    return { ok: false, error: err.message };
  }
}

/**
 * Resynchronisation manuelle (reconciliation) — réapplique l'état ACTUEL de
 * Hotel (publicationStatus dérivé + active) sur l'Accommodation adaptateur,
 * pour rattraper une désynchronisation constatée (échec best-effort
 * précédent, incident, ou toute autre cause). N'invente aucune règle
 * nouvelle : mappe simplement Hotel.publicationStatus 'publie' → 'publie'
 * (les autres statuts hôtel — brouillon/soumis/rejeté — n'ont pas
 * d'équivalent direct visé par la synchronisation habituelle, seule
 * `active` est réappliquée dans ces cas).
 */
async function resyncLinkedAccommodations(hotelId, hotel) {
  const update = { active: hotel.active !== false };
  if (['publie', 'rejete'].includes(hotel.publicationStatus)) {
    update.publicationStatus = hotel.publicationStatus;
  }
  return syncLinkedAccommodations(hotelId, update);
}

/**
 * Création complète d'un hôtel (Property + Hotel + Accommodation-adaptateur)
 * — réutilise `accommodationService.createFullAccommodation` (déjà testé,
 * gère la compensation orpheline) en forçant accommodationType='hotel'.
 */
async function createFullHotel({ propertyData, hotelData, actingUser }) {
  const accommodationData = {
    accommodationType: 'hotel',
    checkInTime: '14:00',
    checkOutTime: '11:00',
  };
  const result = await createFullAccommodation({
    propertyData,
    accommodationData,
    rateData: null,
    hotelInput: { mode: 'create', hotelData: { ...hotelData, manager: actingUser.id } },
    actingUser,
  });
  const hotel = await Hotel.findById(result.hotel);
  return { property: result.property, hotel, accommodation: result.accommodation };
}

/** Mise à jour d'un hôtel existant (Property + Hotel). */
async function updateFullHotel({ property, hotel, propertyUpdates, hotelUpdates, actingUser }) {
  Object.assign(property, propertyUpdates);
  await property.save();

  Object.assign(hotel, hotelUpdates);
  hotel.updatedBy = actingUser.id;
  if (hotel.publicationStatus === 'rejete') {
    hotel.publicationStatus = 'brouillon';
    hotel.rejectionReason = '';
  }
  await hotel.save();
  return { property, hotel };
}

/** Duplique un hôtel (Property + Hotel + RoomCategory actives, jamais les tarifs — l'admin les redéfinit). */
async function duplicateHotel({ hotel, property, actingUser }) {
  const clonedProperty = await Property.create({
    owner: property.owner,
    title: `${property.title} (copie)`,
    description: property.description,
    price: property.price,
    honoraires: property.honoraires,
    fraisVisite: property.fraisVisite,
    status: 'hebergement',
    availability: property.availability,
    type: property.type,
    surface: property.surface,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    livingRooms: property.livingRooms,
    kitchens: property.kitchens,
    constructionType: property.constructionType,
    amenities: property.amenities,
    images: property.images,
    address: property.address,
    location: property.location,
    longitude: property.longitude,
    latitude: property.latitude,
    statusAdmin: 'En attente',
  });

  const clonedHotel = await Hotel.create({
    name: `${hotel.name} (copie)`,
    brand: hotel.brand,
    description: hotel.description,
    starRating: hotel.starRating,
    phone: hotel.phone,
    email: hotel.email,
    website: hotel.website,
    contact: hotel.contact,
    services: hotel.services,
    hotelServices: hotel.hotelServices,
    hasRestaurant: hotel.hasRestaurant,
    hasReception: hotel.hasReception,
    gallery: hotel.gallery,
    manager: hotel.manager,
    property: clonedProperty._id,
    createdBy: actingUser.id,
  });

  await Accommodation.create({
    property: clonedProperty._id,
    accommodationType: 'hotel',
    hotel: clonedHotel._id,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    createdBy: actingUser.id,
  });

  const categories = await RoomCategory.find({ hotel: hotel._id, status: 'actif' });
  const clonedCategories = await Promise.all(categories.map((cat) => RoomCategory.create({
    hotel: clonedHotel._id,
    name: cat.name,
    description: cat.description,
    capacity: cat.capacity,
    beds: cat.beds,
    surface: cat.surface,
    unitsAvailable: cat.unitsAvailable,
    amenities: cat.amenities,
    gallery: cat.gallery,
    createdBy: actingUser.id,
  })));

  return { property: clonedProperty, hotel: clonedHotel, categories: clonedCategories };
}

/** Supprime intégralement un hôtel : catégories + tarifs + Accommodation + Property + images. */
async function deleteHotel({ hotel, property }) {
  const categories = await RoomCategory.find({ hotel: hotel._id });
  await RatePlan.deleteMany({ roomCategory: { $in: categories.map((c) => c._id) } });
  await RoomCategory.deleteMany({ hotel: hotel._id });
  await Accommodation.deleteMany({ hotel: hotel._id });
  await Hotel.findByIdAndDelete(hotel._id);
  if (property) {
    await Property.findByIdAndDelete(property._id);
    await cleanupImages(property.images);
  }
}

/** Liste paginée pour le dashboard admin ("Établissements"). */
async function listHotelsForAdmin({ status, search, sort, page = 1, limit = 20 }) {
  const query = {};
  if (status && status !== 'tous') query.publicationStatus = status;

  let hotelsQuery = Hotel.find(query).populate({
    path: 'property',
    select: 'title images address owner price statusAdmin availability',
    ...(search ? { match: { title: new RegExp(search, 'i') } } : {}),
  });

  const sortMap = { recent: { updatedAt: -1 }, ancien: { updatedAt: 1 } };
  hotelsQuery = hotelsQuery.sort(sortMap[sort] || sortMap.recent);

  let hotels = await hotelsQuery;
  if (search) hotels = hotels.filter((h) => h.property);

  const total = hotels.length;
  const start = (Math.max(1, Number(page) || 1) - 1) * (Number(limit) || 20);
  const paged = hotels.slice(start, start + (Number(limit) || 20));

  return { hotels: paged, total, page: Number(page) || 1, limit: Number(limit) || 20 };
}

module.exports = {
  computeHotelCompletionScore, syncLinkedAccommodations, resyncLinkedAccommodations,
  createFullHotel, updateFullHotel, duplicateHotel, deleteHotel, listHotelsForAdmin,
  HOTEL_COMPLETION_WEIGHTS,
};
