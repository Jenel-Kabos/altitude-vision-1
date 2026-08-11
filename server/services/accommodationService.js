// server/services/accommodationService.js
//
// Logique métier Hébergement : complétude, publication/rejet, visibilité
// publique, sérialisation. Pattern calqué sur rentalListingSyncService.js
// (Sprint 1.5 §02) mais volontairement plus simple : pas de workflow
// d'occupation, pas de bail, pas de maintenance — hors périmètre Sprint 2.

const mongoose = require('mongoose');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const Hotel = require('../models/Hotel');
const { destroyFromCloudinary } = require('../config/cloudinary');
const { escapeRegex } = require('../utils/regexEscape');
const logger = require('../utils/logger');

/**
 * Suppression compensatoire best-effort : ne bloque jamais la propagation de
 * l'erreur métier initiale si elle échoue à son tour, mais journalise pour
 * ne jamais masquer un document orphelin silencieusement (voir logs Render).
 * Ne renvoie jamais les détails internes de cet échec au client.
 */
const compensateDelete = (label, promise) => promise.catch((err) => {
  logger.error(`Compensation ${label} échouée — document potentiellement orphelin`, err);
});

/** Best-effort : ne bloque jamais la compensation si Cloudinary est indisponible. */
const cleanupImages = (images = []) => Promise.all(images.map((url) => destroyFromCloudinary(url)));

const ACCOMMODATION_REQUIRED_FIELDS = [
  ['accommodationType', (acc) => Boolean(acc.accommodationType)],
  ['capacity', (acc) => Number(acc.capacity?.maxAdults) > 0],
  ['checkInTime', (acc) => Boolean(acc.checkInTime)],
  ['checkOutTime', (acc) => Boolean(acc.checkOutTime)],
];

// bedrooms/bathrooms sont vérifiés sur Property (source de vérité unique,
// voir Accommodation.js) et non sur Accommodation lui-même.
const PROPERTY_REQUIRED_FIELDS = [
  ['bedrooms', (property) => Number.isFinite(property?.bedrooms)],
  ['bathrooms', (property) => Number(property?.bathrooms) > 0],
];

/**
 * Un hébergement est-il prêt (données propres + bien complètes) pour être
 * soumis ? `property` est requis pour vérifier bedrooms/bathrooms — la
 * complétude du reste de Property (titre, photos, adresse…) est déjà
 * validée par ses propres règles, inchangées.
 */
function evaluateReadiness(accommodation, property) {
  const missingFields = [
    ...ACCOMMODATION_REQUIRED_FIELDS.filter(([, test]) => !test(accommodation)),
    ...PROPERTY_REQUIRED_FIELDS.filter(([, test]) => !test(property)),
  ].map(([field]) => field);
  return { ready: missingFields.length === 0, missingFields };
}

/**
 * Un hébergement est visible publiquement seulement si :
 *  - Property est publiable selon les règles EXISTANTES (statusAdmin
 *    'Validée' + availability 'Disponible') — inchangé, jamais réévalué ici ;
 *  - Accommodation.publicationStatus === 'publie' ;
 *  - Accommodation.active !== false (Sprint B1 : levier de désactivation
 *    temporaire du propriétaire, sans perte du statut 'publie').
 * Vente/Location ne passent jamais par cette fonction — leur visibilité
 * reste 100% gouvernée par Property seul, comme avant ce sprint.
 */
function isPubliclyVisible(property, accommodation) {
  if (!property || property.statusAdmin !== 'Validée' || property.availability !== 'Disponible') {
    return false;
  }
  if (property.status !== 'hebergement') return true; // règle Vente/Location inchangée
  return accommodation?.publicationStatus === 'publie' && accommodation?.active !== false;
}

// Sprint B1 — score de complétude. Chaque catégorie vaut un poids fixe
// (somme = 100) et est "acquise" en tout-ou-rien (pas de fraction partielle
// dans ce sprint — plus simple à auditer/tester, et suffisant pour bloquer
// la publication d'une annonce manifestement incomplète).
const COMPLETION_WEIGHTS = {
  informations: 20,
  photos: 20,
  tarifs: 20,
  equipements: 20,
  regles: 10,
  services: 10,
};

function hasAnyAmenity(amenities) {
  if (!amenities) return false;
  return Object.values(amenities).some((list) => Array.isArray(list) && list.length > 0);
}

function hasAnyIncludedService(services) {
  if (!services) return false;
  return Object.values(services).some(Boolean);
}

/**
 * Calcule le score de complétude d'un hébergement (0-100) + le détail par
 * catégorie, utilisé pour bloquer la publication (voir reviewDecision) et
 * pour l'affichage en dashboard/modération.
 * @param {object} accommodation — document Accommodation (ou plain object)
 * @param {object} property — Property lié (bedrooms/bathrooms/title/description/images)
 * @param {Array} rates — tarifs actifs (au moins un requis pour la catégorie "tarifs")
 */
function computeCompletionScore(accommodation, property, rates = []) {
  const checks = {
    title: { label: 'Titre', valid: Boolean(property?.title) },
    description: { label: 'Description', valid: Boolean(property?.description) },
    accommodationType: { label: "Type d’hébergement", valid: Boolean(accommodation?.accommodationType) },
    capacity: { label: 'Capacité', valid: Number(accommodation?.capacity?.maxAdults) > 0 },
    bedrooms: { label: 'Nombre de chambres', valid: Number.isFinite(property?.bedrooms) },
    bathrooms: { label: 'Nombre de salles de bain', valid: Number(property?.bathrooms) > 0 },
    images: { label: 'Photos (3 minimum)', valid: (property?.images?.length || 0) >= 3 },
    rates: { label: 'Tarif', valid: (rates || []).some((rate) => rate.active !== false && Number(rate.amount) > 0) },
    amenities: { label: 'Équipements', valid: hasAnyAmenity(accommodation?.amenities) },
    checkInTime: { label: "Heure d’arrivée", valid: Boolean(accommodation?.checkInTime) },
    checkOutTime: { label: 'Heure de départ', valid: Boolean(accommodation?.checkOutTime) },
    includedServices: { label: 'Services inclus', valid: hasAnyIncludedService(accommodation?.includedServices) },
  };
  const valid = (...fields) => fields.every((field) => checks[field].valid);

  const breakdown = {
    informations: valid('title', 'description', 'accommodationType', 'capacity', 'bedrooms', 'bathrooms') ? COMPLETION_WEIGHTS.informations : 0,
    photos: valid('images') ? COMPLETION_WEIGHTS.photos : 0,
    tarifs: valid('rates') ? COMPLETION_WEIGHTS.tarifs : 0,
    equipements: valid('amenities') ? COMPLETION_WEIGHTS.equipements : 0,
    regles: valid('checkInTime', 'checkOutTime') ? COMPLETION_WEIGHTS.regles : 0,
    services: valid('includedServices') ? COMPLETION_WEIGHTS.services : 0,
  };
  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const missingFields = Object.entries(checks)
    .filter(([, check]) => !check.valid)
    .map(([field, check]) => ({ field, label: check.label }));
  return { score, breakdown, complete: score === 100, missingFields };
}

function serializeAccommodation(doc, rates = []) {
  if (!doc) return null;
  const raw = doc.toObject ? doc.toObject() : { ...doc };
  return { ...raw, rates };
}

/**
 * Un tarif nightly initial a-t-il été fourni et est-il exploitable ?
 * Un montant absent/nul/négatif est traité comme "pas de tarif" (le tarif
 * reste optionnel à la création — voir Sprint 2 §05).
 */
function hasValidInitialRate(rateInput) {
  return Boolean(rateInput) && Number(rateInput.amount) > 0;
}

/**
 * Résout la référence Hotel d'un Accommodation 'hotel' :
 *  - hotelInput.mode === 'existing' → vérifie que l'Hotel existe réellement
 *    (jamais de référence arbitraire/inexistante) ; ne sera JAMAIS supprimé
 *    par la compensation (l'utilisateur l'a choisi, pas créé) ;
 *  - hotelInput.mode === 'create'   → crée un nouvel Hotel minimal, rattaché
 *    au Property en cours de création ; celui-ci EST compensé (supprimé) si
 *    une étape suivante échoue.
 *  - hotelInput absent/null (type non-hôtel) → { hotelId: null }.
 *
 * @returns {Promise<{hotelId: string|null, hotelWasCreated: boolean}>}
 */
async function resolveHotel({ hotelInput, propertyId, actingUser }) {
  if (!hotelInput) return { hotelId: null, hotelWasCreated: false };

  if (hotelInput.mode === 'existing') {
    if (!mongoose.isValidObjectId(hotelInput.hotelId)) {
      const err = new Error("Référence d'établissement hôtelier invalide.");
      err.statusCode = 422;
      throw err;
    }
    const hotel = await Hotel.findById(hotelInput.hotelId);
    if (!hotel) {
      const err = new Error("L'établissement hôtelier sélectionné est introuvable.");
      err.statusCode = 422;
      throw err;
    }
    return { hotelId: hotel._id, hotelWasCreated: false };
  }

  // mode === 'create'
  try {
    const hotel = await Hotel.create({
      ...hotelInput.hotelData,
      property: propertyId,
      createdBy: actingUser.id,
      tenant: actingUser.platformTenant?._id || actingUser.platformTenant || null,
    });
    return { hotelId: hotel._id, hotelWasCreated: true };
  } catch (error) {
    const wrapped = new Error(`Échec de création de l'établissement hôtelier : ${error.message}`);
    wrapped.step = 'hotel';
    if (error.name === 'ValidationError') wrapped.statusCode = 422;
    throw wrapped;
  }
}

/** Compensation ciblée : ne supprime le Hotel que s'il vient d'être créé. */
async function compensateHotel(hotelId, hotelWasCreated) {
  if (hotelWasCreated && hotelId) {
    await compensateDelete(`Hotel(${hotelId})`, Hotel.findByIdAndDelete(hotelId));
  }
}

/**
 * Création complète et atomique (côté applicatif) d'un hébergement depuis le
 * dashboard admin : Property + (Hotel optionnel) + Accommodation + RatePlan
 * initial optionnel.
 *
 * Pas de transaction MongoDB ici (aucun précédent dans ce codebase, et le
 * driver/replica-set n'a jamais été validé pour ça) — compensation explicite
 * à la place : toute étape qui échoue déclenche la suppression des documents
 * déjà créés, pour ne jamais laisser de Property orphelin sans Accommodation.
 * Un Hotel existant sélectionné par l'admin n'est en revanche JAMAIS supprimé
 * par la compensation — seul un Hotel créé pendant CET appel l'est.
 *
 * @param {object} params
 * @param {object} params.propertyData   — payload prêt pour Property.create()
 *   (status déjà forcé à 'hebergement' par l'appelant)
 * @param {object} params.accommodationData — champs ALLOWED_FIELDS d'Accommodation
 * @param {object|null} params.rateData  — { mode, amount, currency } ou null
 * @param {object|null} params.hotelInput — { mode: 'existing', hotelId } ou
 *   { mode: 'create', hotelData } ou `null` (type non-hôtel)
 * @param {object} params.actingUser     — req.user (créateur)
 * @returns {Promise<{property, accommodation, rate, hotel: ObjectId|null}>}
 */
async function createFullAccommodation({ propertyData, accommodationData, rateData, hotelInput, actingUser }) {
  const property = await Property.create(propertyData);

  let hotelId = null;
  let hotelWasCreated = false;
  try {
    ({ hotelId, hotelWasCreated } = await resolveHotel({ hotelInput, propertyId: property._id, actingUser }));
  } catch (error) {
    await compensateDelete(`Property(${property._id})`, Property.findByIdAndDelete(property._id));
    await cleanupImages(property.images);
    throw error; // déjà enrichi (.statusCode) par resolveHotel
  }

  let accommodation;
  try {
    accommodation = await Accommodation.create({
      ...accommodationData,
      hotel: hotelId,
      property: property._id,
      createdBy: actingUser.id,
      tenant: actingUser.platformTenant?._id || actingUser.platformTenant || null,
    });
  } catch (error) {
    await compensateHotel(hotelId, hotelWasCreated);
    await compensateDelete(`Property(${property._id})`, Property.findByIdAndDelete(property._id));
    await cleanupImages(property.images);
    const wrapped = new Error(`Échec de création de l'hébergement (Property annulé) : ${error.message}`);
    wrapped.step = 'accommodation';
    // 409 : doublon (unique property). 422 : données rejetées par le schéma
    // (ValidationError). Toute autre erreur (DB indisponible…) reste 500 —
    // c'est une panne, pas une erreur de saisie de l'admin.
    if (error.code === 11000) wrapped.statusCode = 409;
    else if (error.name === 'ValidationError') wrapped.statusCode = 422;
    throw wrapped;
  }

  let rate = null;
  if (hasValidInitialRate(rateData)) {
    try {
      rate = await RatePlan.create({
        accommodation: accommodation._id,
        mode: rateData.mode || 'nightly',
        amount: rateData.amount,
        currency: rateData.currency || 'XAF',
        createdBy: actingUser.id,
      });
    } catch (error) {
      await compensateDelete(`Accommodation(${accommodation._id})`, Accommodation.findByIdAndDelete(accommodation._id));
      await compensateHotel(hotelId, hotelWasCreated);
      await compensateDelete(`Property(${property._id})`, Property.findByIdAndDelete(property._id));
      await cleanupImages(property.images);
      const wrapped = new Error(`Échec de création du tarif (Property et Accommodation annulés) : ${error.message}`);
      wrapped.step = 'rate';
      if (error.name === 'ValidationError') wrapped.statusCode = 422;
      throw wrapped;
    }
  }

  return { property, accommodation, rate, hotel: hotelId };
}

/**
 * Mise à jour d'un hébergement existant depuis le dashboard admin — met à
 * jour Property, puis met à jour (ou crée s'il manque exceptionnellement)
 * l'Accommodation lié (y compris sa référence Hotel, voir ci-dessous), puis
 * upsert le tarif nightly (désactive l'ancien tarif actif du même mode
 * plutôt que d'en créer un doublon — même convention que
 * accommodationController.upsertRate).
 *
 * Gestion de la référence Hotel :
 *  - `hotelInput` fourni ('existing'|'create') → résout/crée le Hotel et
 *    remplace `accommodation.hotel` (jamais de suppression du Hotel
 *    précédemment rattaché — il peut être réutilisé ailleurs) ;
 *  - `accommodationData.accommodationType` change vers un type non-hôtel →
 *    `accommodation.hotel` est remis à `null` ; si plus aucun Accommodation
 *    ne référence l'ancien Hotel, `hotelOrphaned: true` est renvoyé (simple
 *    signal informatif, l'établissement n'est jamais supprimé automatiquement) ;
 *  - `hotelInput` absent et le type reste inchangé → `accommodation.hotel`
 *    n'est pas touché.
 *
 * @returns {Promise<{property, accommodation, rate, hotelOrphaned: boolean}>}
 */
async function updateFullAccommodation({ property, accommodationData, rateData, hotelInput, actingUser }) {
  let accommodation = await Accommodation.findOne({ property: property._id });
  let hotelOrphaned = false;
  const previousHotelId = accommodation?.hotel || null;

  if (!accommodation) {
    let hotelId = null;
    if (hotelInput) {
      ({ hotelId } = await resolveHotel({ hotelInput, propertyId: property._id, actingUser }));
    }
    accommodation = await Accommodation.create({
      ...accommodationData,
      hotel: hotelId,
      property: property._id,
      createdBy: actingUser.id,
      tenant: actingUser.platformTenant?._id || actingUser.platformTenant || null,
    });
  } else {
    const becomesNonHotel = accommodationData.accommodationType
      && !Accommodation.HOTEL_ACCOMMODATION_TYPES.includes(accommodationData.accommodationType);

    Object.assign(accommodation, accommodationData);
    accommodation.updatedBy = actingUser.id;
    if (accommodation.publicationStatus === 'rejete') {
      accommodation.publicationStatus = 'brouillon';
      accommodation.rejectionReason = '';
    }

    if (hotelInput) {
      const { hotelId } = await resolveHotel({ hotelInput, propertyId: property._id, actingUser });
      accommodation.hotel = hotelId;
    } else if (becomesNonHotel) {
      accommodation.hotel = null;
    }

    await accommodation.save();

    if (previousHotelId && String(previousHotelId) !== String(accommodation.hotel || '')) {
      const stillReferenced = await Accommodation.countDocuments({ hotel: previousHotelId });
      hotelOrphaned = stillReferenced === 0;
    }
  }

  let rate = null;
  if (hasValidInitialRate(rateData)) {
    const mode = rateData.mode || 'nightly';
    await RatePlan.updateMany(
      { accommodation: accommodation._id, mode, active: true },
      { $set: { active: false } },
    );
    rate = await RatePlan.create({
      accommodation: accommodation._id,
      mode,
      amount: rateData.amount,
      currency: rateData.currency || 'XAF',
      createdBy: actingUser.id,
    });
  }

  return { property, accommodation, rate, hotelOrphaned };
}

/**
 * Duplique un hébergement (Property + Accommodation + tarifs actifs) pour le
 * propriétaire : la copie repart systématiquement en 'brouillon' — jamais
 * publiée automatiquement — pour repasser par la modération. Les images
 * Cloudinary sont réutilisées telles quelles (mêmes URLs, aucun nouvel
 * upload : conforme à "Ne pas modifier Cloudinary").
 */
async function duplicateAccommodation({ accommodation, property, actingUser }) {
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

  const clonedAccommodation = await Accommodation.create({
    property: clonedProperty._id,
    accommodationType: accommodation.accommodationType,
    hotel: accommodation.hotel,
    furnished: accommodation.furnished,
    capacity: accommodation.capacity,
    beds: accommodation.beds,
    checkInTime: accommodation.checkInTime,
    checkOutTime: accommodation.checkOutTime,
    minimumStay: accommodation.minimumStay,
    maximumStay: accommodation.maximumStay,
    amenities: accommodation.amenities,
    rules: accommodation.rules,
    houseRules: accommodation.houseRules,
    includedServices: accommodation.includedServices,
    gallery: accommodation.gallery,
    cancellationPolicy: accommodation.cancellationPolicy,
    securityDeposit: accommodation.securityDeposit,
    cleaningFee: accommodation.cleaningFee,
    currency: accommodation.currency,
    createdBy: actingUser.id,
    tenant: actingUser.platformTenant?._id || actingUser.platformTenant || accommodation.tenant || null,
  });

  const activeRates = await RatePlan.find({ accommodation: accommodation._id, active: true });
  const clonedRates = await Promise.all(activeRates.map((rate) => RatePlan.create({
    accommodation: clonedAccommodation._id,
    mode: rate.mode,
    amount: rate.amount,
    currency: rate.currency,
    createdBy: actingUser.id,
  })));

  return { property: clonedProperty, accommodation: clonedAccommodation, rates: clonedRates };
}

/**
 * Supprime intégralement un hébergement : Accommodation, ses RatePlan, le
 * Property porteur et ses images Cloudinary. Best-effort sur les
 * compensations Cloudinary (voir cleanupImages) — ne bloque jamais la
 * suppression métier si Cloudinary est indisponible.
 */
async function deleteAccommodation({ accommodation, property }) {
  await RatePlan.deleteMany({ accommodation: accommodation._id });
  await Accommodation.findByIdAndDelete(accommodation._id);
  await Property.findByIdAndDelete(property._id);
  await cleanupImages(property.images);
}

/**
 * Liste paginée pour le dashboard admin ("Tous les hébergements") — filtrage
 * par statut de publication, type, recherche texte (titre du Property via
 * agrégation légère), tri et pagination. Reste séparé de
 * `ManagePropertiesPage`/`getAllProperties` (générique Vente/Location/
 * Hébergement) car les statuts filtrés ici (brouillon/soumis/publié/
 * suspendu/rejeté) sont propres à Accommodation, pas à Property.statusAdmin.
 */
async function listAccommodationsForAdmin({ status, type, city, availability, search, sort, page = 1, limit = 20, independentOnly = false, validatedOnly = false, activeOnly = false }) {
  const query = {};
  if (status && status !== 'tous') query.publicationStatus = status;
  if (type && type !== 'tous') query.accommodationType = type;
  if (independentOnly) {
    query.accommodationType = { $ne: 'hotel' };
    query.hotel = null;
  }
  if (activeOnly) query.active = { $ne: false };

  let accommodationsQuery = Accommodation.find(query).populate({
    path: 'property',
    select: 'title images address owner bedrooms bathrooms price statusAdmin availability',
    ...((search || city || availability || validatedOnly) ? { match: {
      ...(search ? { title: new RegExp(escapeRegex(search), 'i') } : {}),
      ...(city ? { 'address.city': new RegExp(escapeRegex(city), 'i') } : {}),
      ...(availability ? { availability } : {}),
      ...(validatedOnly ? { statusAdmin: 'Validée' } : {}),
    } } : {}),
  });

  const sortMap = {
    recent: { updatedAt: -1 },
    ancien: { updatedAt: 1 },
    prix_asc: { updatedAt: -1 }, // le prix vit sur Property — tri appliqué après population si demandé
    prix_desc: { updatedAt: -1 },
  };
  accommodationsQuery = accommodationsQuery.sort(sortMap[sort] || sortMap.recent);

  let accommodations = await accommodationsQuery;
  if (search || city || availability || validatedOnly) accommodations = accommodations.filter((acc) => acc.property); // match null → exclu

  if (sort === 'prix_asc') accommodations.sort((a, b) => (a.property?.price || 0) - (b.property?.price || 0));
  if (sort === 'prix_desc') accommodations.sort((a, b) => (b.property?.price || 0) - (a.property?.price || 0));

  const total = accommodations.length;
  const start = (Math.max(1, Number(page) || 1) - 1) * (Number(limit) || 20);
  const paged = accommodations.slice(start, start + (Number(limit) || 20));

  return { accommodations: paged, total, page: Number(page) || 1, limit: Number(limit) || 20 };
}

module.exports = {
  evaluateReadiness, isPubliclyVisible, serializeAccommodation,
  createFullAccommodation, updateFullAccommodation, hasValidInitialRate,
  computeCompletionScore, duplicateAccommodation, deleteAccommodation,
  listAccommodationsForAdmin,
  ACCOMMODATION_REQUIRED_FIELDS, PROPERTY_REQUIRED_FIELDS,
};
