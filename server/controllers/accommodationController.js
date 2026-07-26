// server/controllers/accommodationController.js
const mongoose = require('mongoose');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const Property = require('../models/Property');
const {
  evaluateReadiness, serializeAccommodation, isPubliclyVisible,
  createFullAccommodation, updateFullAccommodation,
  computeCompletionScore, duplicateAccommodation, deleteAccommodation,
  listAccommodationsForAdmin,
} = require('../services/accommodationService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { notify } = require('../services/notificationService');
const {
  uploadFilesToCloudinary, parseAmenities, parseStringArray,
  parseNonNegativeAmount, parseAddress, parseGeoLocation, buildBasePropertyData,
  parseNumericField,
} = require('./propertyController');
const { destroyFromCloudinary } = require('../config/cloudinary');
const { createFullMobileAccommodation } = require('../services/accommodation/mobileAccommodationPublicationService');

const fail = (res, statusCode, message, extra = {}) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message, ...extra });

/** Best-effort : n'interrompt jamais la réponse d'erreur en cours. */
const cleanupUploadedImages = (images = []) =>
  Promise.all(images.map((url) => destroyFromCloudinary(url))).catch(() => {});

// bedrooms/bathrooms sont volontairement absents : Property reste leur
// unique source de vérité (voir Accommodation.js et accommodationService.js).
const ALLOWED_FIELDS = [
  'accommodationType', 'furnished', 'capacity', 'beds',
  'checkInTime', 'checkOutTime', 'minimumStay', 'maximumStay',
  'houseRules', 'cancellationPolicy', 'securityDeposit', 'cleaningFee', 'currency',
  'amenities', 'rules', 'includedServices', 'gallery',
];

async function getActiveRates(accommodationId) {
  return RatePlan.find({ accommodation: accommodationId, active: true }).sort({ mode: 1 });
}

/** Format "HH:MM" strict (24h) — même contrainte que le type `time` HTML5. */
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
function parseTimeField(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!TIME_RE.test(value)) {
    const err = new Error(`${label} doit être au format HH:MM (ex : 14:00).`);
    err.statusCode = 422;
    throw err;
  }
  return value;
}

/**
 * `capacity` peut arriver en JSON (`capacity: '{"maxAdults":4}'`) ou en champs
 * à plat FormData (`capacity[maxAdults]`, `capacity[maxChildren]`) — même
 * stratégie que parseAddress côté propertyController.
 */
function parseCapacity(req) {
  const { capacity } = req.body;
  let data = {};
  if (typeof capacity === 'string') {
    try { data = JSON.parse(capacity); } catch (e) { data = {}; }
  } else if (capacity && typeof capacity === 'object') {
    data = capacity;
  }
  const maxAdults = parseNumericField(data.maxAdults ?? req.body['capacity[maxAdults]'], 'La capacité (adultes)');
  const maxChildren = parseNumericField(data.maxChildren ?? req.body['capacity[maxChildren]'], 'La capacité (enfants)');
  const out = {};
  if (maxAdults !== undefined) out.maxAdults = maxAdults;
  if (maxChildren !== undefined) out.maxChildren = maxChildren;
  return out;
}

/**
 * Parse un champ objet arrivant soit en JSON string (`amenities: '{"cuisine":["four"]}'`),
 * soit déjà en objet (appel programmatique/tests). Retourne `undefined` si le
 * champ est absent, pour ne jamais écraser silencieusement une valeur
 * existante en édition partielle.
 */
function parseJSONObjectField(req, key) {
  const raw = req.body[key];
  if (raw === undefined) return undefined;
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) { return undefined; }
  }
  return undefined;
}

/** Construit le payload Accommodation (ALLOWED_FIELDS) à partir du body admin. */
function buildAccommodationData(req) {
  const {
    accommodationType, furnished, beds, checkInTime, checkOutTime,
    minimumStay, maximumStay, houseRules, cancellationPolicy,
    securityDeposit, cleaningFee, currency,
  } = req.body;

  const data = { accommodationType };
  const capacity = parseCapacity(req);
  if (Object.keys(capacity).length > 0) data.capacity = capacity;
  // Nom de champ transporté "accommodationAmenities" (distinct de
  // "amenities", déjà utilisé pour le champ générique texte libre de
  // Property dans le même payload) — mappé ici vers Accommodation.amenities.
  const amenities = parseJSONObjectField(req, 'accommodationAmenities');
  if (amenities !== undefined) data.amenities = amenities;
  const rules = parseJSONObjectField(req, 'rules');
  if (rules !== undefined) data.rules = rules;
  const includedServices = parseJSONObjectField(req, 'includedServices');
  if (includedServices !== undefined) data.includedServices = includedServices;
  const gallery = parseJSONObjectField(req, 'gallery');
  if (gallery !== undefined) data.gallery = gallery;
  if (furnished !== undefined) data.furnished = furnished === 'true' || furnished === true;
  const parsedBeds = parseNumericField(beds, 'Le nombre de lits');
  if (parsedBeds !== undefined) data.beds = parsedBeds;
  const parsedCheckIn = parseTimeField(checkInTime, 'Le check-in');
  if (parsedCheckIn !== undefined) data.checkInTime = parsedCheckIn;
  const parsedCheckOut = parseTimeField(checkOutTime, 'Le check-out');
  if (parsedCheckOut !== undefined) data.checkOutTime = parsedCheckOut;
  const parsedMinStay = parseNumericField(minimumStay, 'La durée minimale du séjour');
  if (parsedMinStay !== undefined) data.minimumStay = parsedMinStay;
  const parsedMaxStay = parseNumericField(maximumStay, 'La durée maximale du séjour');
  if (parsedMaxStay !== undefined) data.maximumStay = parsedMaxStay;
  if (parsedMinStay !== undefined && parsedMaxStay !== undefined && parsedMaxStay < parsedMinStay) {
    const err = new Error('La durée maximale du séjour doit être supérieure ou égale à la durée minimale.');
    err.statusCode = 422;
    throw err;
  }
  if (houseRules !== undefined) data.houseRules = parseStringArray(houseRules);
  if (cancellationPolicy) data.cancellationPolicy = cancellationPolicy;
  const parsedDeposit = parseNumericField(securityDeposit, 'La caution de séjour');
  if (parsedDeposit !== undefined) data.securityDeposit = parsedDeposit;
  const parsedCleaning = parseNumericField(cleaningFee, 'Les frais de ménage');
  if (parsedCleaning !== undefined) data.cleaningFee = parsedCleaning;
  if (currency) data.currency = currency;
  return data;
}

/** Construit le payload RatePlan (nightly) — `null` si aucun tarif fourni. */
function buildRateData(req) {
  const { nightlyPrice, rateCurrency } = req.body;
  const amount = parseNumericField(nightlyPrice, 'Le prix par nuit');
  if (amount === undefined) return null;
  return { mode: 'nightly', amount, currency: rateCurrency || undefined };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Construit `hotelInput` pour accommodationService (création/mise à jour) à
 * partir du body admin :
 *  - `null` si accommodationType n'est pas 'hotel' (aucune référence exigée
 *    pour villa_meublee/maison_meublee/appartement_meuble/studio_meuble/
 *    chambre_hotes — voir Accommodation.HOTEL_ACCOMMODATION_TYPES) ;
 *  - { mode: 'existing', hotelId } ou { mode: 'create', hotelData } sinon.
 * Lève une erreur 422 explicite pour toute donnée incohérente — jamais de
 * référence Hotel arbitraire ni de nom d'hôtel manquant à la création.
 */
function buildHotelInput(req, { accommodationType, required }) {
  const isHotelType = accommodationType && Accommodation.HOTEL_ACCOMMODATION_TYPES.includes(accommodationType);
  const { hotelMode, hotelId } = req.body;

  if (!isHotelType) return null; // type non-hôtel : aucune référence acceptée
  if (!hotelMode) {
    if (!required) return null; // édition : type hôtel inchangé, rien à modifier côté Hotel
    const err = new Error("Le mode de rattachement à l'hôtel (existant ou nouveau) est requis.");
    err.statusCode = 422;
    throw err;
  }

  if (hotelMode === 'existing') {
    if (!hotelId) {
      const err = new Error("Un établissement hôtelier doit être sélectionné.");
      err.statusCode = 422;
      throw err;
    }
    // Vérifié ici (avant toute création de Property) pour rejeter un ID mal
    // formé au même stade que les autres champs invalides — l'existence
    // réelle du document est revérifiée par accommodationService.resolveHotel
    // (défense en profondeur, notamment pour l'appel depuis updateFull où le
    // Property existe déjà).
    if (!mongoose.isValidObjectId(hotelId)) {
      const err = new Error("Référence d'établissement hôtelier invalide.");
      err.statusCode = 422;
      throw err;
    }
    return { mode: 'existing', hotelId };
  }

  if (hotelMode === 'create') {
    const {
      hotelName, hotelDescription, hotelStarRating, hotelPhone,
      hotelEmail, hotelWebsite, hotelServices, hotelHasRestaurant, hotelHasReception,
    } = req.body;

    if (!hotelName || !hotelName.trim()) {
      const err = new Error("Le nom de l'hôtel est requis pour créer un nouvel établissement.");
      err.statusCode = 422;
      throw err;
    }
    if (hotelEmail && !EMAIL_RE.test(hotelEmail)) {
      const err = new Error("L'adresse email de l'hôtel est invalide.");
      err.statusCode = 422;
      throw err;
    }
    const starRating = parseNumericField(hotelStarRating, "Le nombre d'étoiles");
    if (starRating !== undefined && (starRating < 1 || starRating > 5)) {
      const err = new Error("Le nombre d'étoiles doit être compris entre 1 et 5.");
      err.statusCode = 422;
      throw err;
    }

    return {
      mode: 'create',
      hotelData: {
        name: hotelName.trim(),
        description: hotelDescription || '',
        starRating: starRating ?? null,
        phone: hotelPhone || '',
        email: hotelEmail || '',
        website: hotelWebsite || '',
        services: hotelServices !== undefined ? parseStringArray(hotelServices) : [],
        hasRestaurant: hotelHasRestaurant === 'true' || hotelHasRestaurant === true,
        hasReception: hotelHasReception === 'true' || hotelHasReception === true,
      },
    };
  }

  const err = new Error('Mode de rattachement hôtel invalide (existing ou create attendu).');
  err.statusCode = 422;
  throw err;
}

/**
 * Construit le payload Property (mêmes champs que propertyController.createProperty).
 * Délègue à `buildBasePropertyData` (Sprint A) — status forcé à 'hebergement',
 * jamais accepté depuis le client, comme avant ce refactor (zéro changement
 * de comportement).
 */
async function buildPropertyData(req, ownerId) {
  return buildBasePropertyData(req, ownerId, 'hebergement');
}

// ─────────────────────────────────────────────
// POST /api/accommodations/mobile/full — publication mobile atomique et
// idempotente (Property + Accommodation + RatePlan + soumission en une seule
// transaction Mongo, correctif robustesse 2026-07). Contrôleur volontairement
// mince : toute la logique vit dans mobileAccommodationPublicationService.js
// (réutilisée telle quelle par de futurs points d'entrée si besoin).
// ─────────────────────────────────────────────
exports.createFullMobile = async (req, res) => {
  const { publicationRequestId, publicationKind, property, accommodation, ratePlan, roomCategories } = req.body || {};
  try {
    const result = await createFullMobileAccommodation({
      user: req.user,
      payload: { publicationKind, property, accommodation, ratePlan, roomCategories },
      publicationRequestId,
    });
    return res.status(result.idempotent ? 200 : 201).json({
      status: 'success',
      data: {
        property: result.property,
        accommodation: serializeAccommodation(result.accommodation, result.rate ? [result.rate] : []),
        rate: result.rate,
        hotel: result.hotel,
        roomCategories: result.roomCategories,
        categoryRates: result.categoryRates,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
    return fail(res, statusCode, error.message, error.code ? { code: error.code, ...error.extra } : {});
  }
};

// ─────────────────────────────────────────────
// POST /api/accommodations — propriétaire crée le profil hébergement
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.body.property)) {
      return fail(res, 422, 'Un Property valide est obligatoire.');
    }
    const property = await Property.findById(req.body.property);
    if (!property) return fail(res, 404, 'Bien introuvable.');
    if (property.owner.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous n'êtes pas propriétaire de ce bien.");
    }
    if (property.status !== 'hebergement') {
      return fail(res, 422, "Ce bien n'est pas de type hébergement.");
    }
    if (!req.body.accommodationType || !Accommodation.ACCOMMODATION_TYPES.includes(req.body.accommodationType)) {
      return fail(res, 422, "Type d'hébergement invalide ou manquant.");
    }

    const details = Object.fromEntries(
      ALLOWED_FIELDS.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]),
    );

    let accommodation;
    try {
      accommodation = await Accommodation.create({
        property: property._id,
        createdBy: req.user.id,
        ...details,
      });
    } catch (error) {
      if (error.code === 11000) return fail(res, 409, 'Ce bien possède déjà un profil hébergement.');
      throw error;
    }

    logAction({
      action: 'Hébergement créé',
      description: `Profil hébergement créé pour "${property.title}"`,
      module: 'Altimmo',
      typeAction: 'CREATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(accommodation._id), type: 'Accommodation', nom: property.title },
      req,
    });

    res.status(201).json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/accommodations/mine — les hébergements du propriétaire connecté
// ─────────────────────────────────────────────
exports.mine = async (req, res) => {
  try {
    const accommodations = await Accommodation.find({ createdBy: req.user.id })
      .populate('property', 'title images address status statusAdmin availability price bedrooms bathrooms')
      .sort({ updatedAt: -1 });
    const withScore = await Promise.all(accommodations.map(async (a) => {
      const rates = await getActiveRates(a._id);
      return {
        ...serializeAccommodation(a, rates),
        completion: computeCompletionScore(a, a.property, rates),
      };
    }));
    res.json({ status: 'success', data: { accommodations: withScore } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/accommodations/public/:id — détail public (correctif crash mobile
// DetailAnnonceScreen, 2026-07 : aucune route de détail Accommodation publique
// n'existait auparavant — cf. mission). Lecture seule, aucune authentification.
// Mêmes règles de visibilité que la recherche publique (isPubliclyVisible) :
// Accommodation publiée + active, Property validée + disponible.
// ─────────────────────────────────────────────
exports.getPublic = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findOne({
      _id: req.params.id, publicationStatus: 'publie', active: { $ne: false },
    }).populate('property');
    if (!accommodation || !isPubliclyVisible(accommodation.property, accommodation)) {
      return fail(res, 404, 'Hébergement introuvable.');
    }
    const rates = await getActiveRates(accommodation._id);
    const property = accommodation.property.toObject ? accommodation.property.toObject() : accommodation.property;
    res.json({
      status: 'success',
      data: {
        property: {
          ...property,
          accommodationType: accommodation.accommodationType,
          accommodationId: accommodation._id,
          accommodation: serializeAccommodation(accommodation, rates),
        },
      },
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/accommodations/:id
// ─────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id).populate('property');
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    const isOwner = accommodation.createdBy.toString() === req.user.id.toString();
    const isStaff = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'].includes(req.user.role);
    if (!isOwner && !isStaff) return fail(res, 403, 'Accès refusé.');
    const rates = await getActiveRates(accommodation._id);
    const completion = computeCompletionScore(accommodation, accommodation.property, rates);
    res.json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation, rates), completion } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/accommodations/:id — propriétaire modifie ses propres données
// ─────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez modifier que vos propres hébergements.");
    }
    ALLOWED_FIELDS.forEach((key) => { if (req.body[key] !== undefined) accommodation[key] = req.body[key]; });
    // Une modification après rejet repart en brouillon, jamais republiée
    // silencieusement — la republication doit repasser par /submit.
    if (accommodation.publicationStatus === 'rejete') {
      accommodation.publicationStatus = 'brouillon';
      accommodation.rejectionReason = '';
    }
    accommodation.updatedBy = req.user.id;
    await accommodation.save();
    res.json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/accommodations/:id/submit — propriétaire soumet à validation
// ─────────────────────────────────────────────
exports.submit = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id).populate('property', 'bedrooms bathrooms');
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez soumettre que vos propres hébergements.");
    }
    if (!['brouillon', 'rejete'].includes(accommodation.publicationStatus)) {
      return fail(res, 409, 'Cet hébergement a déjà été soumis.');
    }
    const readiness = evaluateReadiness(accommodation, accommodation.property);
    if (!readiness.ready) {
      return fail(res, 422, 'Informations incomplètes.', { readiness });
    }
    accommodation.publicationStatus = 'soumis';
    accommodation.submittedAt = new Date();
    accommodation.rejectionReason = '';
    await accommodation.save();

    logAction({
      action: 'Hébergement soumis',
      description: `Hébergement ${accommodation._id} soumis à validation`,
      module: 'Altimmo',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(accommodation._id), type: 'Accommodation' },
      req,
    });

    res.json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/accommodations/status/pending — staff : hébergements soumis à validation
// (même convention que GET /api/properties/status/pending)
// ─────────────────────────────────────────────
exports.pending = async (req, res) => {
  try {
    const accommodations = await Accommodation.find({ publicationStatus: 'soumis' })
      .populate('property', 'title images address owner bedrooms bathrooms')
      .sort({ submittedAt: 1 });
    const withScore = await Promise.all(accommodations.map(async (a) => {
      const rates = await getActiveRates(a._id);
      return {
        ...serializeAccommodation(a, rates),
        completion: computeCompletionScore(a, a.property, rates),
      };
    }));
    res.json({ status: 'success', data: { accommodations: withScore } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/accommodations/admin/list — staff : "Tous les hébergements"
// (filtres statut/type/recherche/tri + pagination — voir accommodationService)
// ─────────────────────────────────────────────
exports.listAdmin = async (req, res) => {
  try {
    const { status, type, search, sort, page, limit } = req.query;
    const result = await listAccommodationsForAdmin({ status, type, search, sort, page, limit });
    const accommodations = await Promise.all(result.accommodations.map(async (a) => {
      const rates = await getActiveRates(a._id);
      return {
        ...serializeAccommodation(a, rates),
        completion: computeCompletionScore(a, a.property, rates),
      };
    }));
    res.json({
      status: 'success',
      data: { accommodations, total: result.total, page: result.page, limit: result.limit },
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/accommodations/:id/:action — staff valide|rejette|suspend|réactive
// (même convention que PATCH /api/properties/:id/:action)
// ─────────────────────────────────────────────
exports.reviewDecision = async (req, res) => {
  try {
    const { id, action } = req.params;
    if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Identifiant invalide.');

    const VALID_ACTIONS = ['validate', 'reject', 'suspend', 'unsuspend'];
    if (!VALID_ACTIONS.includes(action)) {
      return fail(res, 400, 'Action invalide (validate, reject, suspend ou unsuspend attendu).');
    }

    const accommodation = await Accommodation.findById(id).populate('property', 'title owner images bedrooms bathrooms');
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');

    if (['validate', 'reject'].includes(action) && accommodation.publicationStatus !== 'soumis') {
      return fail(res, 409, 'Seul un hébergement soumis peut être validé ou rejeté.');
    }
    if (action === 'suspend' && accommodation.publicationStatus !== 'publie') {
      return fail(res, 409, 'Seul un hébergement publié peut être suspendu.');
    }
    if (action === 'unsuspend' && accommodation.publicationStatus !== 'suspendu') {
      return fail(res, 409, "Seul un hébergement suspendu peut être réactivé.");
    }
    if (['reject', 'suspend'].includes(action) && !String(req.body.reason || '').trim()) {
      return fail(res, 422, 'Un motif est requis.');
    }
    if (action === 'validate') {
      const rates = await getActiveRates(accommodation._id);
      const completion = computeCompletionScore(accommodation, accommodation.property, rates);
      if (!completion.complete) {
        return fail(res, 422, 'Cet hébergement est incomplet et ne peut pas être publié.', { completion });
      }
    }

    const newStatus = { validate: 'publie', reject: 'rejete', suspend: 'suspendu', unsuspend: 'publie' }[action];
    accommodation.publicationStatus = newStatus;
    accommodation.reviewedBy = req.user.id;
    accommodation.rejectionReason = action === 'reject' ? String(req.body.reason).trim() : accommodation.rejectionReason;
    accommodation.suspensionReason = action === 'suspend' ? String(req.body.reason).trim() : (action === 'unsuspend' ? '' : accommodation.suspensionReason);
    if (action === 'validate') accommodation.publishedAt = new Date();
    if (action === 'suspend') accommodation.suspendedAt = new Date();
    await accommodation.save();

    if (accommodation.property?.owner && ['validate', 'reject', 'suspend'].includes(action)) {
      const notifType = { validate: 'bien_valide', reject: 'bien_rejete', suspend: 'bien_rejete' }[action];
      const title = { validate: '✅ Hébergement validé', reject: '❌ Hébergement non validé', suspend: '⛔ Hébergement suspendu' }[action];
      const body = action === 'validate'
        ? `"${accommodation.property.title}" est maintenant visible sur la plateforme.`
        : action === 'reject'
          ? `"${accommodation.property.title}" n'a pas été validé. ${accommodation.rejectionReason}`
          : `"${accommodation.property.title}" a été suspendu. ${accommodation.suspensionReason}`;
      notify({
        recipient: accommodation.property.owner,
        type: notifType,
        title,
        body,
        data: { propertyId: accommodation.property._id.toString(), screen: 'Annonces' },
      }).catch(() => {});
    }

    logAction({
      action: { validate: 'Hébergement validé', reject: 'Hébergement rejeté', suspend: 'Hébergement suspendu', unsuspend: 'Hébergement réactivé' }[action],
      description: `Hébergement ${accommodation._id} → ${newStatus} par l'admin`,
      module: 'Altimmo',
      typeAction: { validate: 'VALIDATION', reject: 'REJET', suspend: 'SUSPENSION', unsuspend: 'REACTIVATION' }[action],
      auteur: buildAuteur(req.user),
      cible: { id: String(id), type: 'Accommodation' },
      req,
    });

    res.json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/accommodations/:id/deactivate | /reactivate — propriétaire
// masque/réaffiche temporairement une annonce PUBLIÉE, sans repasser par la
// modération (contrairement à suspend/unsuspend, réservé au staff).
// ─────────────────────────────────────────────
exports.deactivate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez modifier que vos propres hébergements.");
    }
    // Contrôle final Sprint B2 — pour un hébergement 'hotel', ce levier doit
    // passer par PATCH /api/hotels/:id/deactivate (qui synchronise aussi
    // Hotel.active), jamais ici directement : sinon Hotel.active et
    // Accommodation.active divergent silencieusement.
    if (accommodation.accommodationType === 'hotel') {
      return fail(res, 409, "Un établissement hôtelier se désactive depuis le domaine Hôtellerie (Mes hôtels).");
    }
    accommodation.active = false;
    await accommodation.save();
    res.json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

exports.reactivate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez modifier que vos propres hébergements.");
    }
    if (accommodation.accommodationType === 'hotel') {
      return fail(res, 409, "Un établissement hôtelier se réactive depuis le domaine Hôtellerie (Mes hôtels).");
    }
    accommodation.active = true;
    await accommodation.save();
    res.json({ status: 'success', data: { accommodation: serializeAccommodation(accommodation) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/accommodations/:id/duplicate — propriétaire duplique une annonce
// (nouvelle Property + Accommodation en 'brouillon', tarifs actifs clonés).
// ─────────────────────────────────────────────
exports.duplicate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id).populate('property');
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez dupliquer que vos propres hébergements.");
    }
    // Contrôle final Sprint B2 — un hébergement de type 'hotel' est
    // l'adaptateur d'un Hotel (domaine Hôtellerie), qui possède ses propres
    // catégories/tarifs. Le dupliquer ici créerait une seconde Accommodation
    // pointant vers le MÊME Hotel (jamais un nouveau), un état incohérent.
    // La duplication d'un établissement passe exclusivement par
    // POST /api/hotels/:id/duplicate (voir hotelService.duplicateHotel).
    if (accommodation.accommodationType === 'hotel') {
      return fail(res, 409, "Un établissement hôtelier se duplique depuis le domaine Hôtellerie (Mes hôtels), pas depuis Hébergement.");
    }
    const result = await duplicateAccommodation({
      accommodation, property: accommodation.property, actingUser: req.user,
    });

    logAction({
      action: 'Hébergement dupliqué',
      description: `"${accommodation.property.title}" dupliqué en brouillon`,
      module: 'Altimmo',
      typeAction: 'CREATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(result.accommodation._id), type: 'Accommodation', nom: result.property.title },
      req,
    });

    res.status(201).json({
      status: 'success',
      data: { property: result.property, accommodation: serializeAccommodation(result.accommodation, result.rates) },
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/accommodations/:id — propriétaire supprime définitivement
// (Accommodation + Property + RatePlan + images Cloudinary).
// ─────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id).populate('property');
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez supprimer que vos propres hébergements.");
    }
    // Contrôle final Sprint B2 — supprimer ici ne nettoierait QUE
    // Accommodation + Property, en laissant orphelins le Hotel, ses
    // RoomCategory et leurs RatePlan (référençant un Property désormais
    // supprimé). La suppression d'un établissement doit passer par
    // DELETE /api/hotels/:id (hotelService.deleteHotel), qui cascade
    // correctement sur ces trois entités.
    if (accommodation.accommodationType === 'hotel') {
      return fail(res, 409, "Un établissement hôtelier se supprime depuis le domaine Hôtellerie (Mes hôtels), pas depuis Hébergement.");
    }
    const propertyTitle = accommodation.property?.title || '';
    await deleteAccommodation({ accommodation, property: accommodation.property });

    logAction({
      action: 'Hébergement supprimé',
      description: `"${propertyTitle}" supprimé définitivement`,
      module: 'Altimmo',
      typeAction: 'SUPPRESSION',
      auteur: buildAuteur(req.user),
      cible: { id: String(req.params.id), type: 'Accommodation', nom: propertyTitle },
      req,
    });

    res.json({ status: 'success', data: {} });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// Rate plans (nightly / weekly / monthly / yearly)
// ─────────────────────────────────────────────

exports.listRates = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const rates = await getActiveRates(req.params.id);
    res.json({ status: 'success', data: { rates } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/accommodations/:id/rate-plans — upsert du tarif actif pour un mode
exports.upsertRate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez modifier que vos propres hébergements.");
    }
    const { mode, amount, currency } = req.body;
    if (!RatePlan.RATE_MODES.includes(mode)) return fail(res, 422, 'Mode tarifaire invalide.');
    if (!(Number(amount) > 0)) return fail(res, 422, 'Un montant positif est requis.');

    // Un seul tarif actif par (accommodation, mode) : on désactive l'ancien
    // avant de créer le nouveau plutôt que de le muter — conserve l'historique.
    await RatePlan.updateMany(
      { accommodation: accommodation._id, mode, active: true },
      { $set: { active: false } },
    );
    const rate = await RatePlan.create({
      accommodation: accommodation._id,
      mode,
      amount,
      currency: currency || 'XAF',
      createdBy: req.user.id,
    });

    res.status(201).json({ status: 'success', data: { rate } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// DELETE /api/accommodations/:id/rate-plans/:rateId
exports.deactivateRate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.rateId)) {
      return fail(res, 400, 'Identifiant invalide.');
    }
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return fail(res, 404, 'Hébergement introuvable.');
    if (accommodation.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'Admin') {
      return fail(res, 403, "Vous ne pouvez modifier que vos propres hébergements.");
    }
    const rate = await RatePlan.findOneAndUpdate(
      { _id: req.params.rateId, accommodation: accommodation._id },
      { $set: { active: false } },
      { new: true },
    );
    if (!rate) return fail(res, 404, 'Tarif introuvable.');
    res.json({ status: 'success', data: { rate } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/accommodations/admin — staff (ROLES_ALTIMMO) crée un hébergement
// complet en un seul appel : Property + Accommodation + RatePlan optionnel.
// Restriction de rôle appliquée par le middleware de route (voir
// accommodationRoutes.js) — jamais uniquement côté frontend.
// ─────────────────────────────────────────────
exports.createFull = async (req, res) => {
  try {
    const { accommodationType, owner } = req.body;
    if (!accommodationType || !Accommodation.ACCOMMODATION_TYPES.includes(accommodationType)) {
      return fail(res, 422, "Type d'hébergement invalide ou manquant.");
    }
    const ownerId = mongoose.isValidObjectId(owner) ? owner : req.user.id;

    let propertyData;
    try {
      propertyData = await buildPropertyData(req, ownerId);
    } catch (error) {
      return fail(res, error.statusCode || 422, error.message);
    }
    if (!propertyData.title || !propertyData.description || !Number.isFinite(propertyData.price)) {
      return fail(res, 422, 'Titre, description et prix sont obligatoires.');
    }

    let accommodationData;
    let rateData;
    let hotelInput;
    try {
      accommodationData = buildAccommodationData(req);
      rateData = buildRateData(req);
      hotelInput = buildHotelInput(req, { accommodationType, required: true });
    } catch (error) {
      // Property n'est pas encore créé (aucun document à compenser), mais les
      // images ont déjà pu être uploadées vers Cloudinary — on les nettoie.
      await cleanupUploadedImages(propertyData.images);
      return fail(res, error.statusCode || 422, error.message);
    }

    let result;
    try {
      result = await createFullAccommodation({
        propertyData, accommodationData, rateData, hotelInput, actingUser: req.user,
      });
    } catch (error) {
      return fail(res, error.statusCode || 500, error.message);
    }

    logAction({
      action: 'Hébergement créé (admin)',
      description: `"${result.property.title}" créé depuis le dashboard admin`,
      module: 'Altimmo',
      typeAction: 'CREATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(result.property._id), type: 'Property', nom: result.property.title },
      req,
    });

    res.status(201).json({
      status: 'success',
      data: {
        property: result.property,
        accommodation: serializeAccommodation(result.accommodation, result.rate ? [result.rate] : []),
        rate: result.rate,
        hotel: result.hotel,
      },
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PUT /api/accommodations/admin/:propertyId — staff met à jour un hébergement
// complet existant (Property + Accommodation + tarif nightly).
// ─────────────────────────────────────────────
exports.updateFull = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.propertyId)) return fail(res, 400, 'Identifiant invalide.');
    const property = await Property.findById(req.params.propertyId);
    if (!property) return fail(res, 404, 'Bien introuvable.');
    if (property.status !== 'hebergement') {
      return fail(res, 422, "Ce bien n'est pas de type hébergement.");
    }

    const { accommodationType } = req.body;
    if (accommodationType && !Accommodation.ACCOMMODATION_TYPES.includes(accommodationType)) {
      return fail(res, 422, "Type d'hébergement invalide.");
    }

    // Type "effectif" pour décider si une référence Hotel est pertinente :
    // celui envoyé dans la requête, sinon celui déjà en base (édition
    // partielle — l'admin ne renvoie pas forcément accommodationType).
    const existingAccommodationForType = await Accommodation.findOne({ property: property._id });
    const effectiveType = accommodationType || existingAccommodationForType?.accommodationType;

    // Validé AVANT toute mutation de `property` : si les champs Accommodation/
    // RatePlan/Hotel sont invalides, on ne veut pas avoir déjà persisté une
    // partie de la mise à jour Property (évite un état incohérent mi-modifié).
    let accommodationData;
    let rateData;
    let hotelInput;
    try {
      accommodationData = buildAccommodationData(req);
      if (!accommodationData.accommodationType) delete accommodationData.accommodationType;
      rateData = buildRateData(req);
      hotelInput = buildHotelInput(req, { accommodationType: effectiveType, required: false });
    } catch (error) {
      return fail(res, error.statusCode || 422, error.message);
    }

    // Champs Property (mêmes noms que createProperty) — mise à jour directe,
    // sans upload si aucune nouvelle image n'est fournie.
    const {
      title, description, price, availability, type,
      surface, bedrooms, bathrooms, amenities,
      livingRooms, kitchens, constructionType,
      location, honoraires, fraisVisite, longitude, latitude, existingImages,
    } = req.body;

    if (title !== undefined) property.title = title;
    if (description !== undefined) property.description = description;
    if (price !== undefined && price !== '') property.price = parseFloat(price);
    if (availability) property.availability = availability;
    if (type) property.type = type;
    if (surface !== undefined && surface !== '') property.surface = parseFloat(surface);
    if (bedrooms !== undefined && bedrooms !== '') property.bedrooms = parseInt(bedrooms);
    if (bathrooms !== undefined && bathrooms !== '') property.bathrooms = parseInt(bathrooms);
    if (livingRooms !== undefined && livingRooms !== '') property.livingRooms = parseInt(livingRooms);
    if (kitchens !== undefined && kitchens !== '') property.kitchens = parseInt(kitchens);
    if (constructionType) property.constructionType = constructionType;
    if (amenities !== undefined) property.amenities = parseAmenities(amenities);
    if (longitude !== undefined) property.longitude = longitude;
    if (latitude !== undefined) property.latitude = latitude;
    if (location) property.location = parseGeoLocation(location);
    if (req.body.address) property.address = parseAddress(req);
    if (honoraires !== undefined) {
      const parsed = parseNonNegativeAmount(honoraires, null);
      if (honoraires !== '' && parsed === null) return fail(res, 422, 'Honoraires invalides.');
      property.honoraires = parsed;
    }
    if (fraisVisite !== undefined) {
      const parsed = parseNonNegativeAmount(fraisVisite, 0);
      if (fraisVisite !== '' && parsed === null) return fail(res, 422, 'Frais de visite invalides.');
      property.fraisVisite = parsed;
    }

    const newImages = await uploadFilesToCloudinary(req.files);
    if (newImages.length > 0) {
      const kept = existingImages ? parseStringArray(existingImages) : [];
      property.images = [...kept, ...newImages];
    } else if (existingImages !== undefined) {
      property.images = parseStringArray(existingImages);
    }

    await property.save();

    const result = await updateFullAccommodation({
      property, accommodationData, rateData, hotelInput, actingUser: req.user,
    });

    logAction({
      action: 'Hébergement modifié (admin)',
      description: `"${property.title}" modifié depuis le dashboard admin`,
      module: 'Altimmo',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(property._id), type: 'Property', nom: property.title },
      req,
    });

    res.json({
      status: 'success',
      data: {
        property,
        accommodation: serializeAccommodation(result.accommodation, result.rate ? [result.rate] : []),
        rate: result.rate,
        // Signal informatif seulement — l'ancien Hotel n'est jamais supprimé
        // automatiquement (voir accommodationService.updateFullAccommodation).
        hotelOrphaned: result.hotelOrphaned,
      },
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
