// server/services/accommodationService.js
//
// Logique métier Hébergement : complétude, publication/rejet, visibilité
// publique, sérialisation. Pattern calqué sur rentalListingSyncService.js
// (Sprint 1.5 §02) mais volontairement plus simple : pas de workflow
// d'occupation, pas de bail, pas de maintenance — hors périmètre Sprint 2.

const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const { destroyFromCloudinary } = require('../config/cloudinary');

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
 *  - Accommodation.publicationStatus === 'publie'.
 * Vente/Location ne passent jamais par cette fonction — leur visibilité
 * reste 100% gouvernée par Property seul, comme avant ce sprint.
 */
function isPubliclyVisible(property, accommodation) {
  if (!property || property.statusAdmin !== 'Validée' || property.availability !== 'Disponible') {
    return false;
  }
  if (property.status !== 'hebergement') return true; // règle Vente/Location inchangée
  return accommodation?.publicationStatus === 'publie';
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
 * Création complète et atomique (côté applicatif) d'un hébergement depuis le
 * dashboard admin : Property + Accommodation + RatePlan initial optionnel.
 *
 * Pas de transaction MongoDB ici (aucun précédent dans ce codebase, et le
 * driver/replica-set n'a jamais été validé pour ça) — compensation explicite
 * à la place : toute étape qui échoue déclenche la suppression des documents
 * déjà créés, pour ne jamais laisser de Property orphelin sans Accommodation.
 *
 * @param {object} params
 * @param {object} params.propertyData   — payload prêt pour Property.create()
 *   (status déjà forcé à 'hebergement' par l'appelant)
 * @param {object} params.accommodationData — champs ALLOWED_FIELDS d'Accommodation
 * @param {object|null} params.rateData  — { mode, amount, currency } ou null
 * @param {object} params.actingUser     — req.user (créateur)
 * @returns {Promise<{property, accommodation, rate}>}
 */
async function createFullAccommodation({ propertyData, accommodationData, rateData, actingUser }) {
  const property = await Property.create(propertyData);

  let accommodation;
  try {
    accommodation = await Accommodation.create({
      ...accommodationData,
      property: property._id,
      createdBy: actingUser.id,
    });
  } catch (error) {
    await Property.findByIdAndDelete(property._id).catch(() => {});
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
      await Accommodation.findByIdAndDelete(accommodation._id).catch(() => {});
      await Property.findByIdAndDelete(property._id).catch(() => {});
      await cleanupImages(property.images);
      const wrapped = new Error(`Échec de création du tarif (Property et Accommodation annulés) : ${error.message}`);
      wrapped.step = 'rate';
      if (error.name === 'ValidationError') wrapped.statusCode = 422;
      throw wrapped;
    }
  }

  return { property, accommodation, rate };
}

/**
 * Mise à jour d'un hébergement existant depuis le dashboard admin — met à
 * jour Property, puis met à jour (ou crée s'il manque exceptionnellement)
 * l'Accommodation lié, puis upsert le tarif nightly (désactive l'ancien tarif
 * actif du même mode plutôt que d'en créer un doublon — même convention que
 * accommodationController.upsertRate).
 *
 * @returns {Promise<{property, accommodation, rate}>}
 */
async function updateFullAccommodation({ property, accommodationData, rateData, actingUser }) {
  let accommodation = await Accommodation.findOne({ property: property._id });

  if (!accommodation) {
    accommodation = await Accommodation.create({
      ...accommodationData,
      property: property._id,
      createdBy: actingUser.id,
    });
  } else {
    Object.assign(accommodation, accommodationData);
    accommodation.updatedBy = actingUser.id;
    if (accommodation.publicationStatus === 'rejete') {
      accommodation.publicationStatus = 'brouillon';
      accommodation.rejectionReason = '';
    }
    await accommodation.save();
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

  return { property, accommodation, rate };
}

module.exports = {
  evaluateReadiness, isPubliclyVisible, serializeAccommodation,
  createFullAccommodation, updateFullAccommodation, hasValidInitialRate,
  ACCOMMODATION_REQUIRED_FIELDS, PROPERTY_REQUIRED_FIELDS,
};
