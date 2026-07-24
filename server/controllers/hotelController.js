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
const {
  computeHotelCompletionScore, syncLinkedAccommodations, resyncLinkedAccommodations,
  createFullHotel, updateFullHotel, duplicateHotel, deleteHotel, listHotelsForAdmin,
} = require('../services/hotelService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { notify } = require('../services/notificationService');
const {
  uploadFilesToCloudinary, parseAmenities, parseStringArray,
  parseNonNegativeAmount, parseAddress, parseGeoLocation, buildBasePropertyData,
} = require('./propertyController');
const { assertOperationalHotelAccess, listAccessibleHotels } = require('../services/hotel/hotelAccessScopeService');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');
const { buildExactCiRegexFilter } = require('../services/propertyFilterService');
const { escapeRegex } = require('../utils/regexEscape');

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
const PUBLIC_HOTEL_FIELDS = 'name brand description starRating phone email website contact services hotelServices hasRestaurant hasReception gallery property publicationStatus active';

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
    const categoriesWithRates = await Promise.all(categories.map(async (cat) => ({
      ...cat.toObject(),
      rates: await RatePlan.find({ roomCategory: cat._id, active: true }),
    })));
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
    // F2.6.2 : un non-Admin ne voit que ses hôtels réellement rattachés (jamais {} pour tout
    // le staff Altimmo) — le total (pagination) utilise exactement le même scope que la liste.
    let hotelIds;
    if (req.user.role !== 'Admin') {
      const { hotels: accessibleHotels } = await listAccessibleHotels(req.user);
      hotelIds = accessibleHotels.map((h) => h._id);
      if (hotelIds.length === 0) return res.json({ status: 'success', data: { hotels: [], total: 0, page: Number(page) || 1, limit: Number(limit) || 20 } });
    }
    const result = await listHotelsForAdmin({ status, search, sort, page, limit, hotelIds });
    const { completionByHotel } = await batchCategoriesAndCompletion(result.hotels);
    const hotels = result.hotels.map((h) => ({ ...h.toObject(), completion: completionByHotel.get(String(h._id)) }));
    res.json({ status: 'success', data: { hotels, total: result.total, page: result.page, limit: result.limit } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

function parseHotelServices(req) {
  const raw = req.body.hotelServicesStructured;
  if (raw === undefined) return undefined;
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) { return undefined; }
  }
  return undefined;
}

function parseContact(req) {
  const raw = req.body.contact;
  if (raw === undefined) return undefined;
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) { return undefined; }
  }
  return undefined;
}

function parseGallery(req) {
  const raw = req.body.gallery;
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) { return undefined; }
  }
  return undefined;
}

function buildHotelDataFromBody(req) {
  const { name, brand, description, starRating, phone, email, website, hotelServicesLegacy } = req.body;
  const data = { name, brand: brand || '', description: description || '', phone: phone || '', email: email || '', website: website || '' };
  if (starRating !== undefined && starRating !== '') data.starRating = Number(starRating);
  if (hotelServicesLegacy !== undefined) data.services = parseStringArray(hotelServicesLegacy);
  const structured = parseHotelServices(req);
  if (structured !== undefined) data.hotelServices = structured;
  const contact = parseContact(req);
  if (contact !== undefined) data.contact = contact;
  const gallery = parseGallery(req);
  if (gallery !== undefined) data.gallery = gallery;
  return data;
}

// ─────────────────────────────────────────────
// POST /api/hotels/admin — staff (ROLES_ALTIMMO) crée un établissement complet
// (HotelPropertyForm — dashboard admin)
// ─────────────────────────────────────────────
exports.createFull = async (req, res) => {
  try {
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
    let result;
    try {
      result = await createFullHotel({ propertyData, hotelData, actingUser: req.user });
    } catch (error) {
      return fail(res, error.statusCode || 500, error.message);
    }

    logAction({
      action: 'Hôtel créé',
      description: `"${result.property.title}" créé depuis le dashboard`,
      module: 'Altimmo',
      typeAction: 'CREATION',
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

    res.json({ status: 'success', data: { property: result.property, hotel: result.hotel } });
  } catch (error) {
    fail(res, 500, error.message);
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
    const query = { publicationStatus: 'soumis' };
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

    const hotel = await Hotel.findById(id).populate('property', 'title owner');
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    // F2.6.2 : cette action n'avait auparavant AUCUN contrôle de portée au-delà du filtre de
    // rôle global au niveau route — n'importe quel membre du staff Altimmo pouvait valider,
    // rejeter, suspendre ou réactiver n'importe quel hôtel.
    const { error: scopeError } = await assertHotelAccess(req, hotel._id, CAP.HOTEL_MANAGE);
    if (scopeError) return fail(res, scopeError, scopeError === 404 ? 'Hôtel introuvable.' : 'Accès refusé.');

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
        return fail(res, 422, 'Cet hôtel est incomplet et ne peut pas être publié.', { completion });
      }
    }

    const newStatus = { validate: 'publie', reject: 'rejete', suspend: 'suspendu', unsuspend: 'publie' }[action];
    hotel.publicationStatus = newStatus;
    hotel.reviewedBy = req.user.id;
    hotel.rejectionReason = action === 'reject' ? String(req.body.reason).trim() : hotel.rejectionReason;
    hotel.suspensionReason = action === 'suspend' ? String(req.body.reason).trim() : (action === 'unsuspend' ? '' : hotel.suspensionReason);
    if (action === 'validate') hotel.publishedAt = new Date();
    if (action === 'suspend') hotel.suspendedAt = new Date();
    await hotel.save();

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
    fail(res, 500, error.message);
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
    hotel.active = false;
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
    hotel.active = true;
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
      typeAction: 'CREATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(result.hotel._id), type: 'Hotel', nom: result.hotel.name },
      req,
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    fail(res, 500, error.message);
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
