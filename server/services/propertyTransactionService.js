// server/services/propertyTransactionService.js
//
// Sprint A (séparation Vente/Location) : cœur partagé par
// salePropertyService.js et rentalPropertyService.js — les deux flux sont
// structurellement identiques (Property + un seul satellite, pas de chaîne
// à plusieurs étapes comme Hotel/RoomType/RatePlan dans
// accommodationService.js, qui garde donc sa propre logique de compensation
// séparée). Chaque service métier reste responsable de construire son
// `satelliteData` complet (champs propres à SaleManagement/RentalManagement,
// y compris `owner`/`manager`/`createdBy` selon la convention du modèle) —
// ce module ne fait qu'orchestrer Property + satellite + compensation.
//
// Pas de transaction MongoDB (aucun précédent dans ce codebase, confirmé par
// grep sur `startSession`/`withTransaction` — zéro résultat) — compensation
// explicite, même convention que accommodationService.js.

const Property = require('../models/Property');
const { destroyFromCloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');

const cleanupImages = (images = []) => Promise.all(images.map((url) => destroyFromCloudinary(url)));

/**
 * Suppression compensatoire best-effort : ne bloque jamais la propagation de
 * l'erreur métier initiale, mais journalise pour ne jamais masquer un
 * document orphelin silencieusement.
 */
const compensateDelete = (label, promise) => promise.catch((err) => {
  logger.error(`Compensation ${label} échouée — document potentiellement orphelin`, err);
});

/**
 * Création complète : Property + satellite (SaleManagement ou
 * RentalManagement), avec compensation si le satellite échoue après coup.
 *
 * @param {object} params
 * @param {object} params.propertyData — payload prêt pour Property.create()
 * @param {object} params.satelliteData — payload prêt pour SatelliteModel.create()
 *   (doit déjà inclure owner/manager/createdBy selon le modèle appelant)
 * @param {import('mongoose').Model} params.SatelliteModel
 * @param {string} params.satelliteLabel — nom lisible pour les messages d'erreur/logs
 * @returns {Promise<{property, satellite}>}
 */
async function createFullPropertyTransaction({ propertyData, satelliteData, SatelliteModel, satelliteLabel }) {
  const property = await Property.create(propertyData);

  let satellite;
  try {
    satellite = await SatelliteModel.create({ ...satelliteData, property: property._id });
  } catch (error) {
    await compensateDelete(`Property(${property._id})`, Property.findByIdAndDelete(property._id));
    await cleanupImages(property.images);
    const wrapped = new Error(`Échec de création (${satelliteLabel}) — Property annulé : ${error.message}`);
    wrapped.step = 'satellite';
    // 409 : doublon (unique property). 422 : données rejetées par le schéma.
    // Toute autre erreur (DB indisponible…) reste 500 — panne, pas erreur de saisie.
    if (error.code === 11000) wrapped.statusCode = 409;
    else if (error.name === 'ValidationError') wrapped.statusCode = 422;
    throw wrapped;
  }

  return { property, satellite };
}

/**
 * Mise à jour : le satellite existant est mis à jour (jamais dupliqué) ; il
 * est créé s'il manque exceptionnellement (annonce historique créée avant
 * ce sprint, jamais passée par le nouveau flux admin).
 *
 * `satelliteData` ne doit contenir QUE des champs mutables (jamais
 * `createdBy`, pour ne jamais réécrire l'auteur original lors d'une simple
 * édition) — `satelliteCreateExtra` porte les champs propres à la création
 * exceptionnelle (ex : `createdBy`), appliqués uniquement si le document
 * n'existait pas encore.
 *
 * @returns {Promise<{property, satellite}>}
 */
async function updateFullPropertyTransaction({ property, satelliteData, satelliteCreateExtra = {}, SatelliteModel }) {
  let satellite = await SatelliteModel.findOne({ property: property._id });
  if (!satellite) {
    satellite = await SatelliteModel.create({ ...satelliteData, ...satelliteCreateExtra, property: property._id });
  } else {
    Object.assign(satellite, satelliteData);
    await satellite.save();
  }
  return { property, satellite };
}

module.exports = {
  createFullPropertyTransaction, updateFullPropertyTransaction, cleanupImages, compensateDelete,
};
