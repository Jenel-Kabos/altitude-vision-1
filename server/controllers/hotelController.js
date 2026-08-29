// server/controllers/hotelController.js — Sprint B2 (domaine Hôtellerie)
//
// Étend le périmètre minimal du Sprint Hôtel (list/getOne pour le sélecteur
// admin, conservés tels quels ci-dessous) avec un véritable cycle de vie :
// création/édition dédiées (HotelPropertyForm), dashboard propriétaire
// ("Mes hôtels"), dashboard admin ("Gestion hôtelière"), modération, score
// de complétude. Aucune réservation, aucune chambre physique — voir
// HOTEL_V2.md.

const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const Room = require('../models/Room');
const HotelReservation = require('../models/HotelReservation');
const HousekeepingTask = require('../models/HousekeepingTask');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialRefund = require('../models/FinancialRefund');
const {
  computeHotelCompletionScore, syncLinkedAccommodations, resyncLinkedAccommodations,
  createFullHotel, updateFullHotel, duplicateHotel, deleteHotel, listHotelsForAdmin, listValidatedHotelPortfolio,
} = require('../services/hotelService');
const {
  assertHotelNameAvailable,
  translateHotelNameDuplicate,
} = require('../services/hotel/hotelNameUniquenessService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { notify } = require('../services/notificationService');
const {
  uploadFilesToCloudinary, parseAmenities, parseStringArray,
  parseNonNegativeAmount, parseAddress, parseGeoLocation, buildBasePropertyData,
} = require('../services/propertyPublicationInputService');
const { assertOperationalHotelAccess, listAccessibleHotels } = require('../services/hotel/hotelAccessScopeService');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');
const { buildExactCiRegexFilter } = require('../services/propertyFilterService');
const { escapeRegex } = require('../utils/regexEscape');
const { createFullMobileAccommodation } = require('../services/accommodation/mobileAccommodationPublicationService');

const fail = (res, statusCode, message, extra = {}) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message, ...extra });

// F2.6.2 : l'entité Hotel elle-même passe désormais par le même scope central que les domaines
// opérationnels (F2.6.1) — plus aucun bypass sur la seule base du rôle global. Un utilisateur
// non Admin ne voit/ne modifie que les hôtels auxquels il est effectivement rattaché
// (HotelStaffAssignment actif) ou dont il est le Hotel.manager legacy.
async function assertHotelAccess(req, hotelId, capability) {
  return assertOperationalHotelAccess({ actor: req.user, hotelId, capability });
}

async function getHotelCompletion(hotel, property) {
  const categories = await RoomCategory.find({ hotel: hotel._id, status: 'actif' });
  const rateCounts = await Promise.all(categories.map((cat) =>
    RatePlan.countDocuments({ roomCategory: cat._id, active: true })));
  return computeHotelCompletionScore(hotel, property, categories, rateCounts);
}

/**
 * Contrôle final (audit performances Sprint B2) — équivalent de
 * `getHotelCompletion` mais pour une LISTE d'hôtels : remplace N×(1 + K)
 * requêtes (1 RoomCategory.find + 1 RatePlan.countDocuments par catégorie,
 * PAR hôtel — un N+1 constaté sur listAdmin/mine/pending) par exactement 2
 * requêtes au total, quel que soit le nombre d'hôtels de la page.
 */
async function batchCategoriesAndCompletion(hotels) {
  const hotelIds = hotels.map((h) => h._id);
  const categories = hotelIds.length ? await RoomCategory.find({ hotel: { $in: hotelIds }, status: 'actif' }) : [];
  const categoryIds = categories.map((c) => c._id);

  // Rien à agréger si aucune catégorie n'existe pour cette page d'hôtels —
  // évite un aller-retour DB inutile (et un `undefined.map` si un mock de
  // test ne configure pas `RatePlan.aggregate`).
  const rateCounts = categoryIds.length
    ? await RatePlan.aggregate([
      { $match: { roomCategory: { $in: categoryIds }, active: true } },
      { $group: { _id: '$roomCategory', count: { $sum: 1 } } },
    ])
    : [];
  const countByCategory = new Map(rateCounts.map((r) => [String(r._id), r.count]));

  const categoriesByHotel = new Map();
  categories.forEach((cat) => {
    const key = String(cat.hotel);
    if (!categoriesByHotel.has(key)) categoriesByHotel.set(key, []);
    categoriesByHotel.get(key).push(cat);
  });

  const completionByHotel = new Map(hotels.map((hotel) => {
    const hotelCategories = categoriesByHotel.get(String(hotel._id)) || [];
    const counts = hotelCategories.map((cat) => countByCategory.get(String(cat._id)) || 0);
    return [String(hotel._id), computeHotelCompletionScore(hotel, hotel.property, hotelCategories, counts)];
  }));

  return { categoriesByHotel, completionByHotel };
}

// ─────────────────────────────────────────────
// GET /api/hotels — sélecteur admin (Sprint Hôtel, inchangé)
// ─────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const query = { status: 'actif' };
    if (req.user.role !== 'Admin') {
      const { hotels: accessibleHotels } = await listAccessibleHotels(req.user);
      query._id = { $in: accessibleHotels.map((h) => h._id) };
    }
    const hotels = await Hotel.find(query)
      .select('name starRating phone email')
      .sort({ name: 1 })
      .limit(200);
    res.json({ status: 'success', data: { hotels } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/hotels/:id
// ─────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(req.params.id).populate('property');
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    const { error } = await assertHotelAccess(req, hotel._id, CAP.HOTEL_VIEW);
    if (error) return fail(res, error, error === 404 ? 'Hôtel introuvable.' : 'Accès refusé.');
    const completion = await getHotelCompletion(hotel, hotel.property);
    res.json({ status: 'success', data: { hotel, completion } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/hotels/public/:id — fiche hôtel publique (pages publiques Sprint B2)
// Aucune authentification requise ; ne renvoie jamais un hôtel non publié.
// ─────────────────────────────────────────────
// Contrôle final (audit sécurité/performances Sprint B2) — projection
// explicite : les endpoints publics ne renvoyaient jusqu'ici aucun `select`
// sur Hotel, exposant sans nécessité des identifiants internes
// (manager/createdBy/updatedBy/reviewedBy) et des champs de modération
// (rejectionReason/suspensionReason) à un consommateur non authentifié.
const PUBLIC_HOTEL_FIELDS = 'name brand description starRating phone email website contact services hotelServices hasRestaurant hasReception gallery property publicationStatus active totalRooms totalCapacity totalBeds minNightlyRate maxNightlyRate currency';

exports.getPublic = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(req.params.id).select(PUBLIC_HOTEL_FIELDS).populate('property');
    if (!hotel || hotel.publicationStatus !== 'publie' || hotel.active === false) {
      return fail(res, 404, 'Hôtel introuvable.');
    }
    if (!hotel.property || hotel.property.statusAdmin !== 'Validée' || hotel.property.availability !== 'Disponible') {
      return fail(res, 404, 'Hôtel introuvable.');
    }
    const categories = await RoomCategory.find({ hotel: hotel._id, status: 'actif' });
    categories.sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
    const categoriesWithRates = await Promise.all(categories.map(async (cat) => ({
      ...cat.toObject(),
      rates: await RatePlan.find({ roomCategory: cat._id, active: true }).sort({ amount: 1 }),
    })));
    categoriesWithRates.sort((left, right) => {
      const leftRate = left.rates.find((rate) => rate.rateType === 'public')?.amount ?? Number.MAX_SAFE_INTEGER;
      const rightRate = right.rates.find((rate) => rate.rateType === 'public')?.amount ?? Number.MAX_SAFE_INTEGER;
      return leftRate - rightRate;
    });
    res.json({ status: 'success', data: { hotel, categories: categoriesWithRates } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/hotels/public — liste publique (pages publiques Sprint B2)
// Aucune authentification requise ; ne renvoie que les hôtels publiés,
// actifs, et dont le Property est publiable (mêmes règles que
// accommodationService.isPubliclyVisible).
// ─────────────────────────────────────────────
exports.listPublic = async (req, res) => {
  try {
    // Nomenclature canonique `city` (alias legacy `ville` accepté — audit filtrage Altimmo) ;
    // même filtre exact/insensible-casse/échappé que `propertyController.getAllProperties`
    // (auparavant : égalité stricte sensible à la casse, incohérente avec les biens).
    const { city, ville, search, page = 1, limit = 12 } = req.query;
    const cityFilter = buildExactCiRegexFilter(city !== undefined ? city : ville);
    const hotels = await Hotel.find({ publicationStatus: 'publie', active: { $ne: false } })
      .select(PUBLIC_HOTEL_FIELDS)
      .populate({
        path: 'property',
        select: 'title images address statusAdmin availability price',
        match: {
          statusAdmin: 'Validée',
          availability: 'Disponible',
          ...(cityFilter ? { 'address.city': cityFilter } : {}),
          // Échappé (escapeRegex) : évite le ReDoS sur cette route publique.
          ...(search ? { title: new RegExp(escapeRegex(search), 'i') } : {}),
        },
      })
      .sort({ publishedAt: -1 });

    const visible = hotels.filter((h) => h.property);
    const total = visible.length;
    const start = (Math.max(1, Number(page) || 1) - 1) * (Number(limit) || 12);
    const paged = visible.slice(start, start + (Number(limit) || 12));

    res.json({ status: 'success', data: { hotels: paged, total, page: Number(page) || 1, limit: Number(limit) || 12 } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/hotels/mine — les hôtels du propriétaire connecté
// ─────────────────────────────────────────────
exports.mine = async (req, res) => {
  try {
    const hotels = await Hotel.find({ manager: req.user.id })
      .populate('property', 'title images address statusAdmin availability')
      .sort({ updatedAt: -1 });
    const { completionByHotel } = await batchCategoriesAndCompletion(hotels);
    const withScore = hotels.map((h) => ({ ...h.toObject(), completion: completionByHotel.get(String(h._id)) }));
    res.json({ status: 'success', data: { hotels: withScore } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/hotels/admin/list — dashboard admin "Établissements"
// ─────────────────────────────────────────────
exports.listAdmin = async (req, res) => {
  try {
    const { status, search, sort, page, limit } = req.query;
    const tenantId = req.user.role === 'Admin' ? (req.platformTenant?._id || req.platformTenant || null) : null;
    // F2.6.2 : un non-Admin ne voit que ses hôtels réellement rattachés (jamais {} pour tout
    // le staff Altimmo) — le total (pagination) utilise exactement le même scope que la liste.
    let hotelIds;
    if (req.user.role !== 'Admin') {
      const { hotels: accessibleHotels } = await listAccessibleHotels(req.user);
      hotelIds = accessibleHotels.map((h) => h._id);
      if (hotelIds.length === 0) return res.json({ status: 'success', data: { hotels: [], total: 0, page: Number(page) || 1, limit: Number(limit) || 20 } });
    }
    const result = await listHotelsForAdmin({ status, search, sort, page, limit, hotelIds, tenantId });
    const { completionByHotel } = await batchCategoriesAndCompletion(result.hotels);
    const hotels = result.hotels.map((h) => ({ ...h.toObject(), completion: completionByHotel.get(String(h._id)) }));
    res.json({ status: 'success', data: { hotels, total: result.total, page: result.page, limit: result.limit } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// GET /api/hotels/portfolio — portefeuille exploitable uniquement.
// Aucun paramètre ne peut élargir le filtre de publication imposé par le service.
exports.portfolio = async (req, res) => {
  try {
    const { search, city, district, starRating, sort, page, limit } = req.query;
    const tenantId = req.user.role === 'Admin' ? (req.platformTenant?._id || req.platformTenant || null) : null;
    let hotelIds;
    if (req.user.role !== 'Admin') {
      const { hotels } = await listAccessibleHotels(req.user);
      hotelIds = hotels.map((hotel) => hotel._id);
      if (!hotelIds.length) return res.json({ status: 'success', data: { hotels: [], total: 0, page: Number(page) || 1, limit: Number(limit) || 20 } });
    }
    const result = await listValidatedHotelPortfolio({ search, city, district, starRating, sort, page, limit, hotelIds, tenantId });
    const ids = result.hotels.map((hotel) => hotel._id);
    const roomRows = ids.length ? await Room.aggregate([
      { $match: { hotel: { $in: ids }, active: true } },
      { $group: { _id: '$hotel', totalRooms: { $sum: 1 }, availableRooms: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } }, occupiedRooms: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } } } },
    ]) : [];
    const roomsByHotel = new Map(roomRows.map((row) => [String(row._id), row]));
    const hotels = result.hotels.map((hotel) => {
      const roomStats = roomsByHotel.get(String(hotel._id)) || { totalRooms: 0, availableRooms: 0, occupiedRooms: 0 };
      return { ...hotel.toObject(), operationalStats: { ...roomStats, occupancyRate: roomStats.totalRooms ? Math.round((roomStats.occupiedRooms / roomStats.totalRooms) * 10000) / 100 : 0 } };
    });
    res.json({ status: 'success', data: { ...result, hotels } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

exports.portfolioOne = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const { error } = await assertHotelAccess(req, req.params.id, CAP.HOTEL_VIEW);
    if (error) return fail(res, error, error === 404 ? 'Établissement introuvable.' : 'Accès refusé.');
    const result = await listValidatedHotelPortfolio({ hotelIds: [req.params.id], page: 1, limit: 1 });
    if (!result.hotels.length) return fail(res, 404, 'Établissement validé et actif introuvable.');
    const hotel = result.hotels[0];
    const completion = await getHotelCompletion(hotel, hotel.property);
    res.json({ status: 'success', data: { hotel, completion } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

function parseHotelServices(req) {
  const raw = req.body.hotelServicesStructured;
  if (raw === undefined) return undefined;
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return undefined; }
  }
  return undefined;
}

function parseContact(req) {
  const raw = req.body.contact;
  if (raw === undefined) return undefined;
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return undefined; }
  }
  return undefined;
}

function parseGallery(req) {
  const raw = req.body.gallery;
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return undefined; }
  }
  return undefined;
}

function parseObjectField(value) {
  if (value === undefined) return undefined;
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return undefined; }
  }
  return undefined;
}

function buildHotelDataFromBody(req) {
  const { name, brand, description, starRating, phone, email, website, hotelServicesLegacy, legalName, hotelType, timezone, currency } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (brand !== undefined) data.brand = brand;
  if (description !== undefined) data.description = description;
  if (phone !== undefined) data.phone = phone;
  if (email !== undefined) data.email = email;
  if (website !== undefined) data.website = website;
  if (starRating !== undefined && starRating !== '') data.starRating = Number(starRating);
  if (hotelServicesLegacy !== undefined) data.services = parseStringArray(hotelServicesLegacy);
  const structured = parseHotelServices(req);
  if (structured !== undefined) data.hotelServices = structured;
  const contact = parseContact(req);
  if (contact !== undefined) data.contact = contact;
  const gallery = parseGallery(req);
  if (gallery !== undefined) data.gallery = gallery;
  if (legalName !== undefined) data.legalName = legalName;
  if (hotelType !== undefined) data.hotelType = hotelType;
  if (timezone !== undefined) data.timezone = timezone;
  if (currency !== undefined) data.currency = currency;
  const taxInformation = parseObjectField(req.body.taxInformation);
  if (taxInformation !== undefined) data.taxInformation = taxInformation;
  const policies = parseObjectField(req.body.policies);
  if (policies !== undefined) data.policies = policies;
  const administrativeDocuments = parseObjectField(req.body.administrativeDocuments);
  if (administrativeDocuments !== undefined) data.administrativeDocuments = administrativeDocuments;
  return data;
}

const SENSITIVE_PROPERTY_FIELDS = ['owner', 'title', 'address', 'longitude', 'latitude'];
const SENSITIVE_HOTEL_FIELDS = ['name', 'brand', 'starRating', 'legalName', 'hotelType', 'currency', 'taxInformation', 'administrativeDocuments'];
const changed = (before, after) => JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);

function splitSensitiveUpdates(property, hotel, propertyUpdates, hotelUpdates) {
  const sensitiveProperty = {};
  const sensitiveHotel = {};
  SENSITIVE_PROPERTY_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(propertyUpdates, field) && changed(property[field], propertyUpdates[field])) {
      sensitiveProperty[field] = propertyUpdates[field];
      delete propertyUpdates[field];
    }
  });
  SENSITIVE_HOTEL_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(hotelUpdates, field) && changed(hotel[field], hotelUpdates[field])) {
      sensitiveHotel[field] = hotelUpdates[field];
      delete hotelUpdates[field];
    }
  });
  return { sensitiveProperty, sensitiveHotel };
}

// ─────────────────────────────────────────────
// POST /api/hotels/admin — staff (ROLES_ALTIMMO) crée un établissement complet
// (HotelPropertyForm — dashboard admin)
// ─────────────────────────────────────────────
exports.createFull = async (req, res) => {
  try {
    // H-W1 — le nouveau formulaire Web envoie le même contrat métier que le
    // Mobile. L'URL historique /hotels/(admin|mine) reste disponible, mais
    // devient un adaptateur multipart (upload des photos) vers l'unique
    // service transactionnel de publication.
    if (req.body.publicationPayload) {
      let payload;
      try {
        payload = typeof req.body.publicationPayload === 'string'
          ? JSON.parse(req.body.publicationPayload)
          : req.body.publicationPayload;
      } catch {
        return fail(res, 400, 'Payload de publication hôtelier invalide.');
      }
      const uploadedImages = await uploadFilesToCloudinary(req.files);
      payload = {
        ...payload,
        property: { ...payload.property, photos: uploadedImages },
        accommodation: {
          ...payload.accommodation,
          hotel: {
            ...payload.accommodation?.hotel,
            gallery: uploadedImages.map((url, index) => ({ url, type: 'photo', isCover: index === 0, order: index })),
          },
        },
      };
      try {
        const result = await createFullMobileAccommodation({
          user: req.user,
          payload,
          publicationRequestId: req.body.publicationRequestId || payload.publicationRequestId,
        });
        return res.status(result.idempotent ? 200 : 201).json({
          status: 'success',
          data: {
            property: result.property,
            accommodation: result.accommodation,
            rate: result.rate,
            hotel: result.hotel,
            roomCategories: result.roomCategories,
            categoryRates: result.categoryRates,
            idempotent: result.idempotent,
          },
        });
      } catch (error) {
        return fail(res, error.statusCode || (error.name === 'ValidationError' ? 400 : 500), error.message, error.code ? { code: error.code, ...error.extra } : {});
      }
    }
    if (!req.body.name || !req.body.name.trim()) {
      return fail(res, 422, "Le nom de l'hôtel est requis.");
    }
    // F2.6.2 : l'attribution d'un propriétaire arbitraire est une action sensible sans hôtel
    // existant à rattacher (donc sans portée à vérifier) — resserrée à Admin uniquement (au lieu
    // de tout le staff Altimmo). Un Proprietaire créant son propre hôtel (POST /mine) ne peut
    // jamais se faire passer pour un autre owner (défense en profondeur, inchangé).
    const ownerId = (req.user.role === 'Admin' && mongoose.isValidObjectId(req.body.owner))
      ? req.body.owner
      : req.user.id;
    let propertyData;
    try {
      propertyData = await buildBasePropertyData(req, ownerId, 'hebergement');
    } catch (error) {
      return fail(res, error.statusCode || 422, error.message);
    }
    if (!propertyData.title || !propertyData.description || !Number.isFinite(propertyData.price)) {
      return fail(res, 422, 'Titre, description et prix sont obligatoires.');
    }

    const hotelData = buildHotelDataFromBody(req);
    const accommodationType = req.body.accommodationType || 'hotel';
    if (!Accommodation.HOTEL_ACCOMMODATION_TYPES.includes(accommodationType)) {
      return fail(res, 422, "Type d'établissement hôtelier invalide.");
    }
    let result;
    try {
      result = await createFullHotel({ propertyData, hotelData, accommodationType, actingUser: req.user });
    } catch (error) {
      const typedError = translateHotelNameDuplicate(error);
      return fail(res, typedError.statusCode || 500, typedError.message, typedError.code ? { code: typedError.code } : {});
    }

    logAction({
      action: 'Hôtel créé',
      description: `"${result.property.title}" créé depuis le dashboard`,
      module: 'Altimmo',
      typeAction: 'CRÉATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(result.hotel._id), type: 'Hotel', nom: result.hotel.name },
      req,
    });

    res.status(201).json({ status: 'success', data: { property: result.property, hotel: result.hotel } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PUT /api/hotels/admin/:hotelId — édition complète
// ─────────────────────────────────────────────
exports.updateFull = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(req.params.hotelId);
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    const { error } = await assertHotelAccess(req, hotel._id, CAP.HOTEL_MANAGE);
    if (error) return fail(res, error, error === 404 ? 'Hôtel introuvable.' : "Vous ne pouvez modifier que vos propres hôtels.");
    const property = hotel.property ? await Property.findById(hotel.property) : null;
    if (!property) return fail(res, 404, 'Bien introuvable.');

    const {
      title, description, price, availability, surface, bedrooms, bathrooms,
      livingRooms, kitchens, constructionType, amenities,
      location, honoraires, fraisVisite, longitude, latitude, existingImages,
    } = req.body;

    const propertyUpdates = {};
    if (title !== undefined) propertyUpdates.title = title;
    if (description !== undefined) propertyUpdates.description = description;
    if (price !== undefined && price !== '') propertyUpdates.price = parseFloat(price);
    if (availability) propertyUpdates.availability = availability;
    if (surface !== undefined && surface !== '') propertyUpdates.surface = parseFloat(surface);
    if (bedrooms !== undefined && bedrooms !== '') propertyUpdates.bedrooms = parseInt(bedrooms, 10);
    if (bathrooms !== undefined && bathrooms !== '') propertyUpdates.bathrooms = parseInt(bathrooms, 10);
    if (livingRooms !== undefined && livingRooms !== '') propertyUpdates.livingRooms = parseInt(livingRooms, 10);
    if (kitchens !== undefined && kitchens !== '') propertyUpdates.kitchens = parseInt(kitchens, 10);
    if (constructionType) propertyUpdates.constructionType = constructionType;
    if (amenities !== undefined) propertyUpdates.amenities = parseAmenities(amenities);
    if (longitude !== undefined) propertyUpdates.longitude = longitude;
    if (latitude !== undefined) propertyUpdates.latitude = latitude;
    if (location) propertyUpdates.location = parseGeoLocation(location);
    if (req.body.address) propertyUpdates.address = parseAddress(req);
    if (req.body.owner && req.user.role === 'Admin' && mongoose.isValidObjectId(req.body.owner)) propertyUpdates.owner = req.body.owner;
    if (honoraires !== undefined) {
      const parsed = parseNonNegativeAmount(honoraires, null);
      if (honoraires !== '' && parsed === null) return fail(res, 422, 'Honoraires invalides.');
      propertyUpdates.honoraires = parsed;
    }
    if (fraisVisite !== undefined) {
      const parsed = parseNonNegativeAmount(fraisVisite, 0);
      if (fraisVisite !== '' && parsed === null) return fail(res, 422, 'Frais de visite invalides.');
      propertyUpdates.fraisVisite = parsed;
    }
    const newImages = await uploadFilesToCloudinary(req.files);
    if (newImages.length > 0) {
      const kept = existingImages ? parseStringArray(existingImages) : [];
      propertyUpdates.images = [...kept, ...newImages];
    } else if (existingImages !== undefined) {
      propertyUpdates.images = parseStringArray(existingImages);
    }

    const hotelUpdates = buildHotelDataFromBody(req);
    if (!hotelUpdates.name) delete hotelUpdates.name;

    if (hotelUpdates.name !== undefined) {
      await assertHotelNameAvailable({
        name: hotelUpdates.name,
        tenantId: hotel.tenant,
        managerId: hotel.manager || req.user.id,
        excludeHotelId: hotel._id,
      });
    }

    let proposed = false;
    if (hotel.publicationStatus === 'publie') {
      if (hotel.proposedVersion?.status === 'pending') return fail(res, 409, 'Une modification sensible est déjà en attente de modération.', { code: 'HOTEL_PROPOSED_VERSION_PENDING' });
      const { sensitiveProperty, sensitiveHotel } = splitSensitiveUpdates(property, hotel, propertyUpdates, hotelUpdates);
      if (Object.keys(sensitiveProperty).length || Object.keys(sensitiveHotel).length) {
        proposed = true;
        hotel.proposedVersion = {
          requestId: new mongoose.Types.ObjectId().toString(), status: 'pending',
          propertyChanges: sensitiveProperty, hotelChanges: sensitiveHotel,
          submittedBy: req.user.id, submittedAt: new Date(), rejectionReason: '',
        };
      }
    }

    const result = await updateFullHotel({ property, hotel, propertyUpdates, hotelUpdates, actingUser: req.user });

    logAction({
      action: 'Hôtel modifié',
      description: `"${property.title}" modifié`,
      module: 'Altimmo',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(hotel._id), type: 'Hotel', nom: hotel.name },
      req,
    });

    res.json({ status: 'success', data: { property: result.property, hotel: result.hotel, proposedVersionPending: proposed } });
  } catch (error) {
    const typedError = translateHotelNameDuplicate(error);
    fail(res, typedError.statusCode || 500, typedError.message, typedError.code ? { code: typedError.code } : {});
  }
};

// ─────────────────────────────────────────────
// POST /api/hotels/:id/submit — propriétaire soumet à validation
// ─────────────────────────────────────────────
exports.submit = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(req.params.id).populate('property');
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    // F2.6.3 (volet D) : dernière comparaison directe `Hotel.manager` restante dans ce
    // contrôleur — centralisée pour clôturer complètement l'audit (aucune régression : Admin
    // et manager exact conservent le même accès, un `hotel_manager` rattaché l'obtient aussi).
    const { error } = await assertHotelAccess(req, hotel._id, CAP.HOTEL_MANAGE);
    if (error) return fail(res, error, error === 404 ? 'Hôtel introuvable.' : "Vous ne pouvez soumettre que vos propres hôtels.");
    if (!['brouillon', 'rejete'].includes(hotel.publicationStatus)) {
      return fail(res, 409, 'Cet hôtel a déjà été soumis.');
    }
    hotel.publicationStatus = 'soumis';
    hotel.submittedAt = new Date();
    hotel.rejectionReason = '';
    await hotel.save();
    res.json({ status: 'success', data: { hotel } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/hotels/status/pending — staff : file de modération
// ─────────────────────────────────────────────
exports.pending = async (req, res) => {
  try {
    const query = { $or: [{ publicationStatus: 'soumis' }, { 'proposedVersion.status': 'pending' }] };
    const tenantId = req.user.role === 'Admin' ? (req.platformTenant?._id || req.platformTenant || null) : null;
    if (tenantId) query.tenant = tenantId;
    if (req.user.role !== 'Admin') {
      const { hotels: accessibleHotels } = await listAccessibleHotels(req.user);
      query._id = { $in: accessibleHotels.map((h) => h._id) };
    }
    const hotels = await Hotel.find(query)
      .populate('property', 'title images address owner')
      .sort({ submittedAt: 1 });
    const { categoriesByHotel, completionByHotel } = await batchCategoriesAndCompletion(hotels);
    const withScore = hotels.map((h) => ({
      ...h.toObject(),
      categories: categoriesByHotel.get(String(h._id)) || [],
      completion: completionByHotel.get(String(h._id)),
    }));
    res.json({ status: 'success', data: { hotels: withScore } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/hotels/:id/:action — staff valide|rejette|suspend|réactive
// ─────────────────────────────────────────────
exports.reviewDecision = async (req, res) => {
  try {
    const { id, action } = req.params;
    if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Identifiant invalide.');
    const VALID_ACTIONS = ['validate', 'reject', 'suspend', 'unsuspend'];
    if (!VALID_ACTIONS.includes(action)) return fail(res, 400, 'Action invalide.');

    // La complétude accepte la galerie Hotel OU au moins trois images Property.
    // Conserver les images dans cette projection évite qu'un hôtel affiché à
    // 100 % dans la file de modération soit refusé au moment de la décision.
    const hotel = await Hotel.findById(id).populate('property', 'title owner address longitude latitude images');
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    // F2.6.2 : cette action n'avait auparavant AUCUN contrôle de portée au-delà du filtre de
    // rôle global au niveau route — n'importe quel membre du staff Altimmo pouvait valider,
    // rejeter, suspendre ou réactiver n'importe quel hôtel.
    const { error: scopeError } = await assertHotelAccess(req, hotel._id, CAP.HOTEL_MANAGE);
    if (scopeError) return fail(res, scopeError, scopeError === 404 ? 'Hôtel introuvable.' : 'Accès refusé.');

    const proposed = hotel.proposedVersion?.status === 'pending' ? hotel.proposedVersion : null;
    if (proposed) {
      if (!['validate', 'reject'].includes(action)) return fail(res, 409, 'Cette action ne s’applique pas à une modification proposée.');
      if (action === 'reject' && !String(req.body.reason || '').trim()) return fail(res, 422, 'Un motif est requis.');
      const now = new Date();
      const hotelChanges = proposed.hotelChanges || {};
      const propertyChanges = proposed.propertyChanges || {};
      const previousHotelValues = Object.fromEntries(Object.keys(hotelChanges).map((key) => [key, hotel[key]]));
      const previousPropertyValues = Object.fromEntries(Object.keys(propertyChanges).map((key) => [key, hotel.property?.[key]]));
      const history = {
        requestId: proposed.requestId, decision: action === 'validate' ? 'approved' : 'rejected',
        hotelChanges, propertyChanges, previousHotelValues, previousPropertyValues,
        submittedBy: proposed.submittedBy, reviewedBy: req.user.id,
        submittedAt: proposed.submittedAt, reviewedAt: now, reason: String(req.body.reason || '').trim(),
      };
      const set = { proposedVersion: null, reviewedBy: req.user.id };
      if (action === 'validate') {
        if (hotelChanges.name !== undefined) {
          const { normalizedName } = await assertHotelNameAvailable({
            name: hotelChanges.name,
            tenantId: hotel.tenant,
            managerId: hotel.manager,
            excludeHotelId: hotel._id,
          });
          set.normalizedName = normalizedName;
        }
        Object.assign(set, hotelChanges);
      }
      const transition = await Hotel.updateOne(
        { _id: hotel._id, 'proposedVersion.status': 'pending', 'proposedVersion.requestId': proposed.requestId },
        { $set: set, $push: { versionHistory: history } },
      );
      if (!transition?.modifiedCount) return fail(res, 409, 'Cette modification a déjà été traitée.', { code: 'HOTEL_PROPOSED_VERSION_CONFLICT' });
      if (action === 'validate' && Object.keys(propertyChanges).length) await Property.updateOne({ _id: hotel.property._id }, { $set: propertyChanges });
      Object.assign(hotel, action === 'validate' ? hotelChanges : {}, { proposedVersion: null, reviewedBy: req.user.id });
      logAction({
        action: action === 'validate' ? 'Modification sensible hôtelière validée' : 'Modification sensible hôtelière rejetée',
        description: `Version proposée ${proposed.requestId} ${action === 'validate' ? 'publiée' : 'refusée'}`,
        module: 'Altimmo', typeAction: action === 'validate' ? 'VALIDATION' : 'REJET', auteur: buildAuteur(req.user),
        cible: { id: String(hotel._id), type: 'Hotel', nom: hotel.name }, req,
      });
      return res.json({ status: 'success', data: { hotel, proposedVersionDecision: action } });
    }

    if (['validate', 'reject'].includes(action) && hotel.publicationStatus !== 'soumis') {
      return fail(res, 409, 'Seul un hôtel soumis peut être validé ou rejeté.');
    }
    if (action === 'suspend' && hotel.publicationStatus !== 'publie') {
      return fail(res, 409, 'Seul un hôtel publié peut être suspendu.');
    }
    if (action === 'unsuspend' && hotel.publicationStatus !== 'suspendu') {
      return fail(res, 409, "Seul un hôtel suspendu peut être réactivé.");
    }
    if (['reject', 'suspend'].includes(action) && !String(req.body.reason || '').trim()) {
      return fail(res, 422, 'Un motif est requis.');
    }
    if (action === 'validate') {
      const completion = await getHotelCompletion(hotel, hotel.property);
      if (!completion.complete) {
        return fail(res, 422, 'Cet hôtel est incomplet et ne peut pas être publié.', {
          code: 'HOTEL_INCOMPLETE', completion, missingFields: completion.missingFields,
        });
      }
    }

    const oldStatus = hotel.publicationStatus;
    const newStatus = { validate: 'publie', reject: 'rejete', suspend: 'suspendu', unsuspend: 'publie' }[action];
    const now = new Date();
    const changes = { publicationStatus: newStatus, reviewedBy: req.user.id };
    if (action === 'reject') changes.rejectionReason = String(req.body.reason).trim();
    if (action === 'suspend') { changes.suspensionReason = String(req.body.reason).trim(); changes.suspendedAt = now; }
    if (action === 'unsuspend') changes.suspensionReason = '';
    if (action === 'validate') changes.publishedAt = now;
    const transition = await Hotel.updateOne(
      { _id: hotel._id, publicationStatus: oldStatus },
      { $set: changes, $push: { moderationHistory: { from: oldStatus, to: newStatus, decision: action, reason: String(req.body.reason || '').trim(), comment: String(req.body.comment || '').trim(), moderator: req.user.id, decidedAt: now } } },
    );
    if (!transition?.modifiedCount) return fail(res, 409, 'Cette demande a déjà été traitée par un autre modérateur.', { code: 'HOTEL_MODERATION_CONFLICT' });
    Object.assign(hotel, changes);
    // La Property est l'ancre publique historique. La décision hôtelière
    // reste l'unique action de modération et aligne cette ancre sans créer
    // un second workflow à terminer ailleurs.
    if (hotel.property?._id && ['validate', 'reject'].includes(action)) {
      await Property.updateOne(
        { _id: hotel.property._id },
        { $set: { statusAdmin: action === 'validate' ? 'Validée' : 'Rejetée', reviewedAt: now } },
      );
      hotel.property.statusAdmin = action === 'validate' ? 'Validée' : 'Rejetée';
    }

    // Synchronise l'Accommodation-adaptateur pour que la visibilité publique
    // (isPubliclyVisible, inchangée) suive le nouveau statut hôtel.
    const syncPayload = {
      validate: { publicationStatus: 'publie' },
      reject: { publicationStatus: 'rejete' },
      suspend: { active: false },
      unsuspend: { active: true },
    }[action];
    const syncResult = await syncLinkedAccommodations(hotel._id, syncPayload);
    // Contrôle final (audit divergence Hotel↔Accommodation) : un échec de
    // synchronisation ne doit JAMAIS rester silencieux — Hotel reste la
    // source de vérité et la décision de modération est déjà actée (jamais
    // annulée pour un problème de propagation), mais l'incident est
    // journalisé explicitement (visible dans le dashboard, pas seulement
    // dans les logs serveur) pour permettre une resynchronisation manuelle
    // via POST /api/hotels/:id/resync.
    if (!syncResult.ok) {
      logAction({
        action: 'Synchronisation Hôtel→Hébergement échouée',
        description: `Hotel ${hotel._id} → ${newStatus} appliqué, mais la propagation vers l'Accommodation liée a échoué : ${syncResult.error}`,
        module: 'Altimmo',
        typeAction: 'MODIFICATION',
        auteur: buildAuteur(req.user),
        cible: { id: String(hotel._id), type: 'Hotel' },
        req,
      });
    }

    if (hotel.property?.owner && ['validate', 'reject', 'suspend'].includes(action)) {
      const title = { validate: '✅ Hôtel validé', reject: '❌ Hôtel non validé', suspend: '⛔ Hôtel suspendu' }[action];
      notify({
        recipient: hotel.property.owner,
        type: action === 'validate' ? 'bien_valide' : 'bien_rejete',
        title,
        body: `"${hotel.property.title}" — ${title}.`,
        data: { propertyId: String(hotel.property._id), screen: 'Annonces' },
      }).catch(() => {});
    }

    logAction({
      action: `Hôtel ${newStatus}`,
      description: `Hôtel ${hotel._id} → ${newStatus} par l'admin`,
      module: 'Altimmo',
      typeAction: action === 'validate' ? 'VALIDATION' : action === 'reject' ? 'REJET' : action.toUpperCase(),
      auteur: buildAuteur(req.user),
      cible: { id: String(id), type: 'Hotel' },
      req,
    });

    res.json({ status: 'success', data: { hotel } });
  } catch (error) {
    const typedError = translateHotelNameDuplicate(error);
    fail(res, typedError.statusCode || 500, typedError.message, typedError.code ? { code: typedError.code } : {});
  }
};

// ─────────────────────────────────────────────
// PATCH /api/hotels/:id/deactivate | /reactivate — propriétaire
// ─────────────────────────────────────────────
exports.deactivate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    const { error } = await assertHotelAccess(req, hotel._id, CAP.HOTEL_MANAGE);
    if (error) return fail(res, error, error === 404 ? 'Hôtel introuvable.' : "Vous ne pouvez modifier que vos propres hôtels.");
    const now = new Date();
    const [futureReservations, checkedIn, occupiedRooms, publishedRooms, openHousekeeping, openMaintenance, activeStaff, unpaidDocuments, pendingRefunds] = await Promise.all([
      HotelReservation.countDocuments({ hotel: hotel._id, status: { $in: ['pending', 'confirmed'] }, checkOutDate: { $gt: now } }),
      HotelReservation.countDocuments({ hotel: hotel._id, status: 'checked_in' }),
      Room.countDocuments({ hotel: hotel._id, status: 'occupied' }),
      Room.countDocuments({ hotel: hotel._id, active: true }),
      HousekeepingTask.countDocuments({ hotel: hotel._id, status: { $in: HousekeepingTask.OPEN_HOUSEKEEPING_STATUSES } }),
      MaintenanceTicket.countDocuments({ hotel: hotel._id, status: { $in: MaintenanceTicket.OPEN_MAINTENANCE_STATUSES } }),
      HotelStaffAssignment.countDocuments({ hotel: hotel._id, status: 'active' }),
      FinancialDocument.countDocuments({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id, status: { $in: ['draft', 'issued'] }, paymentStatus: { $ne: 'paid' } }),
      FinancialRefund.countDocuments({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id, status: { $in: ['requested', 'approved', 'processing'] } }),
    ]);
    const blockers = { futureReservations, checkedIn, occupiedRooms, publishedRooms, openHousekeeping, openMaintenance, activeStaff, unpaidDocuments, pendingRefunds };
    if (Object.values(blockers).some(Boolean)) {
      return fail(res, 409, "Impossible d’archiver cet établissement tant que son activité opérationnelle n’est pas clôturée.", { code: 'HOTEL_ARCHIVE_BLOCKED', blockers });
    }
    hotel.active = false;
    hotel.status = 'inactif';
    await hotel.save();
    const syncResult = await syncLinkedAccommodations(hotel._id, { active: false });
    if (!syncResult.ok) {
      logAction({
        action: 'Synchronisation Hôtel→Hébergement échouée',
        description: `Hotel ${hotel._id} désactivé, mais la propagation vers l'Accommodation liée a échoué : ${syncResult.error}`,
        module: 'Altimmo',
        typeAction: 'MODIFICATION',
        auteur: buildAuteur(req.user),
        cible: { id: String(hotel._id), type: 'Hotel' },
        req,
      });
    }
    res.json({ status: 'success', data: { hotel } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

exports.reactivate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    const { error } = await assertHotelAccess(req, hotel._id, CAP.HOTEL_MANAGE);
    if (error) return fail(res, error, error === 404 ? 'Hôtel introuvable.' : "Vous ne pouvez modifier que vos propres hôtels.");
    if (hotel.publicationStatus !== 'publie') return fail(res, 409, 'Un établissement non validé ne peut pas être activé.', { code: 'HOTEL_NOT_APPROVED' });
    const property = await Property.findById(hotel.property).select('statusAdmin availability');
    if (!property || property.statusAdmin !== 'Validée' || property.availability !== 'Disponible') {
      return fail(res, 409, "L’annonce liée doit être validée et disponible avant réactivation.", { code: 'HOTEL_PROPERTY_NOT_APPROVED' });
    }
    hotel.active = true;
    hotel.status = 'actif';
    await hotel.save();
    const syncResult = await syncLinkedAccommodations(hotel._id, { active: true });
    if (!syncResult.ok) {
      logAction({
        action: 'Synchronisation Hôtel→Hébergement échouée',
        description: `Hotel ${hotel._id} réactivé, mais la propagation vers l'Accommodation liée a échoué : ${syncResult.error}`,
        module: 'Altimmo',
        typeAction: 'MODIFICATION',
        auteur: buildAuteur(req.user),
        cible: { id: String(hotel._id), type: 'Hotel' },
        req,
      });
    }
    res.json({ status: 'success', data: { hotel } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/hotels/:id/resync — staff : réconciliation manuelle
// Hotel→Accommodation après un incident de synchronisation constaté (voir
// journalisation "Synchronisation Hôtel→Hébergement échouée" ci-dessus).
// ─────────────────────────────────────────────
exports.resync = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    // F2.6.2 : aucun contrôle de portée n'existait auparavant sur cette action de récupération.
    const { error: scopeError } = await assertHotelAccess(req, hotel._id, CAP.HOTEL_MANAGE);
    if (scopeError) return fail(res, scopeError, scopeError === 404 ? 'Hôtel introuvable.' : 'Accès refusé.');
    const syncResult = await resyncLinkedAccommodations(hotel._id, hotel);
    if (!syncResult.ok) return fail(res, 500, `Resynchronisation échouée : ${syncResult.error}`);

    logAction({
      action: 'Hôtel resynchronisé',
      description: `Hotel ${hotel._id} → Accommodation(s) liée(s) resynchronisée(s) manuellement (${syncResult.modifiedCount}/${syncResult.matchedCount} mise(s) à jour)`,
      module: 'Altimmo',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(hotel._id), type: 'Hotel' },
      req,
    });

    res.json({ status: 'success', data: { matchedCount: syncResult.matchedCount, modifiedCount: syncResult.modifiedCount } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/hotels/:id/duplicate
// ─────────────────────────────────────────────
exports.duplicate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(req.params.id).populate('property');
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    const { error } = await assertHotelAccess(req, hotel._id, CAP.HOTEL_MANAGE);
    if (error) return fail(res, error, error === 404 ? 'Hôtel introuvable.' : "Vous ne pouvez dupliquer que vos propres hôtels.");
    const result = await duplicateHotel({ hotel, property: hotel.property, actingUser: req.user });

    logAction({
      action: 'Hôtel dupliqué',
      description: `"${hotel.name}" dupliqué en brouillon`,
      module: 'Altimmo',
      typeAction: 'CRÉATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(result.hotel._id), type: 'Hotel', nom: result.hotel.name },
      req,
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    const typedError = translateHotelNameDuplicate(error);
    fail(res, typedError.statusCode || 500, typedError.message, typedError.code ? { code: typedError.code } : {});
  }
};

// ─────────────────────────────────────────────
// DELETE /api/hotels/:id
// ─────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(req.params.id).populate('property');
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    const { error } = await assertHotelAccess(req, hotel._id, CAP.HOTEL_MANAGE);
    if (error) return fail(res, error, error === 404 ? 'Hôtel introuvable.' : "Vous ne pouvez supprimer que vos propres hôtels.");
    if (!['brouillon', 'rejete'].includes(hotel.publicationStatus) || hotel.publishedAt) {
      return fail(res, 409, 'Seul un brouillon ou un hôtel refusé jamais publié peut être supprimé.', { code: 'HOTEL_DELETE_NOT_ALLOWED' });
    }
    const [categories, rooms, reservations, payments, documents, refunds, housekeeping, maintenance, staff] = await Promise.all([
      RoomCategory.countDocuments({ hotel: hotel._id }), Room.countDocuments({ hotel: hotel._id }),
      HotelReservation.countDocuments({ hotel: hotel._id }), FinancialPayment.countDocuments({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id }),
      FinancialDocument.countDocuments({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id }), FinancialRefund.countDocuments({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id }),
      HousekeepingTask.countDocuments({ hotel: hotel._id }), MaintenanceTicket.countDocuments({ hotel: hotel._id }), HotelStaffAssignment.countDocuments({ hotel: hotel._id }),
    ]);
    const blockers = { categories, rooms, reservations, payments, documents, refunds, housekeeping, maintenance, staff };
    if (Object.values(blockers).some(Boolean)) return fail(res, 409, 'Suppression impossible : cet hôtel possède déjà des données métier ou un historique.', { code: 'HOTEL_DELETE_BLOCKED', blockers });
    const name = hotel.name;
    await deleteHotel({ hotel, property: hotel.property });

    logAction({
      action: 'Hôtel supprimé',
      description: `"${name}" supprimé définitivement`,
      module: 'Altimmo',
      typeAction: 'SUPPRESSION',
      auteur: buildAuteur(req.user),
      cible: { id: String(req.params.id), type: 'Hotel', nom: name },
      req,
    });

    res.json({ status: 'success', data: {} });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
