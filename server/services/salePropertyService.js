// server/services/salePropertyService.js — Sprint A (séparation Vente/Location).
// Création/édition complète d'une annonce Vente : Property (status='vente')
// + SaleManagement, avec compensation. Voir propertyTransactionService.js
// pour le cœur partagé avec rentalPropertyService.js.

const SaleManagement = require('../models/SaleManagement');
const {
  createFullPropertyTransaction, updateFullPropertyTransaction,
} = require('./propertyTransactionService');

/**
 * @param {object} params
 * @param {object} params.propertyData — status déjà forcé à 'vente' par l'appelant
 * @param {object} params.saleData — champs SaleManagement (ALLOWED_FIELDS)
 * @param {object} params.actingUser
 * @returns {Promise<{property, sale}>}
 */
async function createFullSaleProperty({ propertyData, saleData, actingUser }) {
  const { property, satellite } = await createFullPropertyTransaction({
    propertyData,
    satelliteData: { ...saleData, owner: propertyData.owner, createdBy: actingUser.id },
    SatelliteModel: SaleManagement,
    satelliteLabel: 'SaleManagement',
  });
  return { property, sale: satellite };
}

/**
 * @returns {Promise<{property, sale}>}
 */
async function updateFullSaleProperty({ property, saleData, actingUser }) {
  // `createdBy` n'est fourni qu'à la création exceptionnelle d'un
  // SaleManagement manquant (annonce historique) — jamais réécrit sur un
  // document déjà existant (updateFullPropertyTransaction ne l'applique que
  // via $setOnInsert implicite : Object.assign sur un doc existant ignore
  // ce champ car il n'est jamais dans `saleData` transmis ici, seulement
  // ajouté explicitement pour le cas de création).
  const { satellite } = await updateFullPropertyTransaction({
    property,
    satelliteData: { ...saleData, owner: property.owner, updatedBy: actingUser.id },
    satelliteCreateExtra: { createdBy: actingUser.id },
    SatelliteModel: SaleManagement,
  });
  return { property, sale: satellite };
}

module.exports = { createFullSaleProperty, updateFullSaleProperty };
