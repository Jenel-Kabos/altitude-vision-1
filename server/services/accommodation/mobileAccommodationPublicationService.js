// server/services/accommodation/mobileAccommodationPublicationService.js
//
// Correctif robustesse 2026-07 — le parcours mobile de création d'un hébergement
// enchaînait auparavant 4 appels HTTP indépendants (POST /properties/mobile →
// POST /accommodations → POST /accommodations/:id/rate-plans →
// POST /accommodations/:id/submit) : un échec en cours de route pouvait laisser
// un Property et/ou un Accommodation partiels en base, sans reprise fiable.
//
// Ce service orchestre les 4 écritures dans UNE transaction Mongo (réplique
// requise — voir __tests__/helpers/financialMongoEnvironment.js) : soit tout est
// créé et soumis, soit rien ne l'est. Contrairement à `accommodationService.
// createFullAccommodation` (dashboard admin, compensation applicative
// documentée comme insuffisante quand une transaction est disponible — voir
// mission), ce chemin mobile utilise une vraie transaction MongoDB de bout en
// bout, car il n'a pas à gérer l'optionalité Hotel (toujours hors périmètre du
// parcours mobile Hébergement) qui compliquait ce choix historiquement.
//
// Idempotence : `publicationRequestId` est fourni par le mobile, généré une
// seule fois par tentative de publication et conservé pendant les retries.
// Garantie à deux niveaux :
//  1. Applicatif — relecture de l'existant avant toute écriture (retry séquentiel
//     rapide, réponse identique renvoyée sans reproduire le travail).
//  2. Base — index unique (sparse) sur Accommodation.publicationRequestId : la
//     garantie ultime contre deux requêtes concurrentes avec la même clé (aucune
//     fenêtre de race applicative ne peut produire deux Accommodation pour la
//     même demande).

const mongoose = require('mongoose');
const Property = require('../../models/Property');
const Accommodation = require('../../models/Accommodation');
const RatePlan = require('../../models/RatePlan');
const Hotel = require('../../models/Hotel');
const RoomCategory = require('../../models/RoomCategory');
const { buildMobilePropertyData } = require('../../controllers/propertyMobileController');
const { evaluateReadiness } = require('../accommodationService');
const { logAction, buildAuteur } = require('../actionLogService');
const { destroyFromCloudinary } = require('../../config/cloudinary');
const { fail, MobileAccommodationError } = require('./mobileAccommodationError');
const { analyzeHotelRoomCategories } = require('./hotelPublicationPayload');

const MAX_ATTEMPTS = 5;
const WINNER_WAIT_ATTEMPTS = 10;
const WINNER_WAIT_DELAY_MS = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Best-effort : ne bloque jamais la réponse d'erreur en cours. */
const cleanupUploadedImages = (images = []) =>
  Promise.all(images.map((url) => destroyFromCloudinary(url))).catch(() => {});

/**
 * Valide la FORME du payload avant toute écriture (400 immédiat, aucune
 * transaction ouverte). Ne valide PAS les conditions de "readiness" pour la
 * soumission (bathrooms>0, capacity, checkInTime/checkOutTime,
 * accommodationType réellement supporté sans Hotel...) — celles-ci restent
 * évaluées par `evaluateReadiness` (réutilisée telle quelle, jamais dupliquée)
 * à l'étape submit, À L'INTÉRIEUR de la transaction, pour rester l'unique
 * source de vérité des règles de complétude déjà utilisées par
 * `accommodationController.submit`.
 */
function validatePayloadShape(payload) {
  const property = payload?.property || {};
  const accommodation = payload?.accommodation || {};
  const ratePlan = payload?.ratePlan || {};
  const errors = [];
  const furnishedTypes = ['villa_meublee', 'maison_meublee', 'appartement_meuble', 'studio_meuble', 'residence_meublee', 'bungalow'];
  const hotelTypes = ['hotel', 'residence_hoteliere', 'chambre_hotes', 'autre'];

  if (!String(property.titre || '').trim()) errors.push('property.titre');
  if (!String(property.description || '').trim()) errors.push('property.description');
  if (!property.type) errors.push('property.type');
  if (!property.ville) errors.push('property.ville');
  if (!property.arrondissement) errors.push('property.arrondissement');
  if (!(Number(property.superficie) > 0)) errors.push('property.superficie');
  const hotelAnalysis = payload?.publicationKind === 'hotel_establishment'
    ? analyzeHotelRoomCategories(payload?.roomCategories)
    : null;
  if (!(Number(property.prix) > 0)) errors.push('property.prix');
  if (!Array.isArray(property.photos) || property.photos.length === 0) errors.push('property.photos');
  if (!accommodation.accommodationType) errors.push('accommodation.accommodationType');
  if (payload?.publicationKind !== 'hotel_establishment' && !(Number(ratePlan.amount) > 0)) errors.push('ratePlan.amount');
  if (payload?.publicationKind !== 'hotel_establishment' && Number(property.prix) !== Number(ratePlan.amount)) errors.push('property.prix/ratePlan.amount');
  if (!['furnished_accommodation', 'hotel_establishment'].includes(payload?.publicationKind)) errors.push('publicationKind');
  if (payload?.publicationKind === 'furnished_accommodation' && !furnishedTypes.includes(accommodation.accommodationType)) errors.push('accommodation.accommodationType');
  if (payload?.publicationKind === 'hotel_establishment' && !hotelTypes.includes(accommodation.accommodationType)) errors.push('accommodation.accommodationType');
  if (payload?.publicationKind === 'hotel_establishment' && !String(accommodation.hotel?.name || '').trim()) errors.push('accommodation.hotel.name');
  if (hotelAnalysis) {
    errors.push(...hotelAnalysis.errors);
    if (Number(property.prix) !== hotelAnalysis.totals?.minNightlyRate) errors.push('property.prix/minNightlyRate');
  }

  if (errors.length > 0) {
    fail(
      'MOBILE_ACCOMMODATION_VALIDATION_ERROR',
      `Payload de publication invalide ou incomplet : ${errors.join(', ')}.`,
      400,
      { fields: errors },
    );
  }
}

/**
 * Cherche une publication déjà traitée pour cette clé. Lève un 403 si elle
 * appartient à un autre utilisateur (une clé d'idempotence n'est jamais
 * partageable entre comptes) — ne renvoie JAMAIS silencieusement les données
 * d'un tiers.
 */
async function findExistingPublication(publicationRequestId, userId) {
  const accommodation = await Accommodation.findOne({ publicationRequestId }).populate('property');
  if (!accommodation) return null;
  if (String(accommodation.createdBy) !== String(userId)) {
    fail(
      'MOBILE_ACCOMMODATION_IDEMPOTENCY_KEY_CONFLICT',
      'Cette clé de publication est déjà utilisée par un autre utilisateur.',
      403,
    );
  }
  const rate = await RatePlan.findOne({ accommodation: accommodation._id }).sort({ createdAt: -1 });
  const hotel = accommodation.hotel ? await Hotel.findById(accommodation.hotel) : null;
  const categories = hotel ? await RoomCategory.find({ hotel: hotel._id }).sort({ displayOrder: 1 }) : [];
  const categoryRates = categories.length
    ? await RatePlan.find({ roomCategory: { $in: categories.map((category) => category._id) }, active: true })
    : [];
  return { property: accommodation.property, accommodation, rate: rate || categoryRates[0] || null, hotel, roomCategories: categories, categoryRates, idempotent: true };
}

async function waitForPublication(publicationRequestId, userId) {
  for (let i = 0; i < WINNER_WAIT_ATTEMPTS; i += 1) {
    const found = await findExistingPublication(publicationRequestId, userId);
    if (found) return found;
    await sleep(WINNER_WAIT_DELAY_MS);
  }
  return null;
}

/** Erreurs métier déterministes : jamais retentées, jamais résolues via l'attente d'un "gagnant". */
function isBusinessError(error) {
  if (error instanceof MobileAccommodationError) return true;
  if (error.name === 'ValidationError') return true;
  if (Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 500) return true;
  return false;
}

/** Erreurs d'écriture concurrente/infrastructure : peuvent signifier qu'une autre tentative a gagné. */
function isRetryableWriteError(error) {
  if (error?.code === 11000) return true;
  if (typeof error?.hasErrorLabel === 'function') {
    return error.hasErrorLabel('TransientTransactionError') || error.hasErrorLabel('UnknownTransactionCommitResult');
  }
  return false;
}

const ownerIdOf = (user) => user._id || user.id;

/**
 * Publication mobile atomique et idempotente d'un hébergement complet
 * (Property + Accommodation + RatePlan + soumission), en une seule transaction
 * Mongo. Les images sont déjà uploadées sur Cloudinary par le mobile avant cet
 * appel (convention existante `/properties/mobile`) — en cas d'échec définitif,
 * elles sont détruites explicitement (rollback Mongo seul ne les efface pas).
 *
 * @returns {Promise<{property, accommodation, rate, idempotent: boolean}>}
 */
async function createFullMobileAccommodation({ user, payload, publicationRequestId }) {
  if (!publicationRequestId || typeof publicationRequestId !== 'string') {
    fail('MOBILE_ACCOMMODATION_MISSING_IDEMPOTENCY_KEY', 'publicationRequestId est requis.', 400);
  }

  const ownerId = ownerIdOf(user);

  // Chemin rapide : retry séquentiel (même clé déjà traitée avec succès) —
  // aucune écriture, aucun re-upload, réponse strictement identique.
  const existing = await findExistingPublication(publicationRequestId, ownerId);
  if (existing) return existing;

  validatePayloadShape(payload);
  const hotelAnalysis = payload.publicationKind === 'hotel_establishment'
    ? analyzeHotelRoomCategories(payload.roomCategories)
    : null;

  const uploadedImages = Array.isArray(payload.property.photos) ? payload.property.photos : [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const propertyData = buildMobilePropertyData(
        {
          ...payload.property,
          prix: hotelAnalysis?.totals.minNightlyRate ?? payload.property.prix,
          categorie: 'hebergement',
        },
        ownerId,
      );
      const [property] = await Property.create([propertyData], { session });

      let hotel = null;
      if (payload.publicationKind === 'hotel_establishment') {
        [hotel] = await Hotel.create([{
          name: payload.accommodation.hotel.name,
          description: payload.accommodation.hotel.description,
          starRating: payload.accommodation.hotel.starRating,
          hasReception: payload.accommodation.hotel.hasReception,
          hotelServices: payload.accommodation.hotel.hotelServices,
          phone: payload.accommodation.hotel.phone,
          email: payload.accommodation.hotel.email,
          website: payload.accommodation.hotel.website,
          gallery: payload.accommodation.hotel.gallery,
          totalRooms: hotelAnalysis.totals.totalRooms,
          totalCapacity: hotelAnalysis.totals.totalCapacity,
          totalBeds: hotelAnalysis.totals.totalBeds,
          minNightlyRate: hotelAnalysis.totals.minNightlyRate,
          maxNightlyRate: hotelAnalysis.totals.maxNightlyRate,
          currency: hotelAnalysis.totals.currency,
          manager: ownerId,
          property: property._id,
          createdBy: ownerId,
          publicationStatus: 'soumis',
          submittedAt: new Date(),
        }], { session });
      }

      const [accommodation] = await Accommodation.create([{
        accommodationType: payload.accommodation.accommodationType,
        furnished: payload.accommodation.furnished !== false,
        capacity: payload.accommodation.capacity,
        beds: payload.accommodation.beds,
        checkInTime: payload.accommodation.checkInTime,
        checkOutTime: payload.accommodation.checkOutTime,
        houseRules: payload.accommodation.houseRules,
        securityDeposit: payload.accommodation.securityDeposit,
        cleaningFee: payload.accommodation.cleaningFee,
        amenities: payload.accommodation.amenities,
        hotel: hotel?._id,
        property: property._id,
        createdBy: ownerId,
        publicationRequestId,
      }], { session });

      let rate = null;
      let roomCategories = [];
      let categoryRates = [];
      if (hotelAnalysis) {
        roomCategories = await RoomCategory.create(hotelAnalysis.categories.map((category) => ({
          hotel: hotel._id, name: category.name, code: category.code,
          categoryType: category.categoryType, displayOrder: category.displayOrder,
          description: category.description,
          capacity: { maxAdults: category.maxAdults, maxChildren: category.maxChildren },
          beds: category.beds, surface: category.surface, unitsAvailable: category.quantity,
          amenities: category.amenities, gallery: category.gallery, createdBy: ownerId,
        })), { session, ordered: true });
        const rateDocuments = roomCategories.flatMap((category, index) => (
          hotelAnalysis.categories[index].ratePlans.map((plan) => ({
            roomCategory: category._id, rateType: plan.rateType,
            amount: plan.amount, currency: plan.currency, createdBy: ownerId,
          }))
        ));
        categoryRates = await RatePlan.create(rateDocuments, { session, ordered: true });
        rate = categoryRates.find((plan) => plan.rateType === 'public') || categoryRates[0];
      } else {
        [rate] = await RatePlan.create([{
          accommodation: accommodation._id,
          mode: payload.ratePlan.mode || 'nightly',
          amount: payload.ratePlan.amount,
          currency: payload.ratePlan.currency || 'XAF',
          createdBy: ownerId,
        }], { session });
      }

      const readiness = payload.publicationKind === 'hotel_establishment'
        ? {
          ready: Boolean(accommodation.accommodationType)
            && Number(accommodation.capacity?.maxAdults) > 0
            && Boolean(accommodation.checkInTime)
            && Boolean(accommodation.checkOutTime)
            && Boolean(hotel),
          missingFields: ['accommodationType', 'capacity', 'checkInTime', 'checkOutTime', 'hotel']
            .filter((field) => ({
              accommodationType: Boolean(accommodation.accommodationType),
              capacity: Number(accommodation.capacity?.maxAdults) > 0,
              checkInTime: Boolean(accommodation.checkInTime),
              checkOutTime: Boolean(accommodation.checkOutTime),
              hotel: Boolean(hotel),
            }[field]) === false),
        }
        : evaluateReadiness(accommodation, property);
      if (!readiness.ready) {
        fail(
          'MOBILE_ACCOMMODATION_NOT_READY',
          'Informations incomplètes pour soumettre cet hébergement à validation.',
          422,
          { missingFields: readiness.missingFields },
        );
      }
      accommodation.publicationStatus = 'soumis';
      accommodation.submittedAt = new Date();
      await accommodation.save({ session });

      await logAction({
        action: 'accommodation.mobile_full_publication',
        description: `Hébergement ${accommodation._id} publié depuis l'app mobile (Property ${property._id})`,
        module: 'Altimmo',
        typeAction: 'CRÉATION',
        auteur: buildAuteur(user),
        cible: { id: String(accommodation._id), type: 'Accommodation' },
        metadata: { publicationRequestId },
        session,
      });

      await session.commitTransaction();
      session.endSession();
      return { property, accommodation, rate, hotel, roomCategories, categoryRates, idempotent: false };
    } catch (error) {
      await session.abortTransaction().catch(() => {});
      session.endSession();

      if (!isBusinessError(error)) {
        const winner = await waitForPublication(publicationRequestId, ownerId);
        if (winner) return winner;
        if (attempt < MAX_ATTEMPTS && isRetryableWriteError(error)) continue;
      }

      await cleanupUploadedImages(uploadedImages);
      throw error;
    }
  }

  // Inatteignable en pratique (MAX_ATTEMPTS épuisées sans succès ni gagnant détecté) —
  // conservé pour ne jamais laisser la fonction résoudre `undefined` silencieusement.
  fail(
    'MOBILE_ACCOMMODATION_CONFLICT_RETRY_EXHAUSTED',
    'Impossible de finaliser la publication après plusieurs tentatives. Réessayez.',
    409,
  );
}

module.exports = { createFullMobileAccommodation, validatePayloadShape, findExistingPublication };
