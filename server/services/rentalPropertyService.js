// server/services/rentalPropertyService.js — Sprint A (séparation Vente/Location).
// Création/édition complète d'une annonce Location : Property
// (status='location') + RentalManagement, avec compensation. Voir
// propertyTransactionService.js pour le cœur partagé avec
// salePropertyService.js.
//
// RentalManagement est aussi la cible du module "Gestion Locative" existant
// (server/controllers/rentalManagementController.js, `POST /api/rental-management`)
// — celui-ci reste inchangé et continue de fonctionner en upsert sur
// `property` : après création via ce service, l'activation ultérieure d'un
// suivi de bail actif (locataire, préavis…) via ce module existant met à
// jour le MÊME document plutôt que d'en créer un doublon (upsert par
// `property`, déjà idempotent côté rentalManagementController.create).

const RentalManagement = require('../models/RentalManagement');
const {
  createFullPropertyTransaction, updateFullPropertyTransaction,
} = require('./propertyTransactionService');

/**
 * @param {object} params
 * @param {object} params.propertyData — status déjà forcé à 'location' par l'appelant
 * @param {object} params.rentalData — champs RentalManagement (fiche + monthlyRent etc.)
 * @param {object} params.actingUser
 * @returns {Promise<{property, rental}>}
 */
async function createFullRentalProperty({ propertyData, rentalData, actingUser }) {
  const { property, satellite } = await createFullPropertyTransaction({
    propertyData,
    // managementActivated: false — cette création vient du flux "simple
    // annonce" (Sprint A), jamais de l'écran d'activation de la Gestion
    // Locative. Le module existant (rentalManagementController.create) le
    // repasse à `true` explicitement au moment de l'activation réelle — voir
    // Section 2 de l'audit, server/docs/PROPERTY_TRANSACTION_ARCHITECTURE.md.
    satelliteData: { ...rentalData, owner: propertyData.owner, manager: actingUser.id, managementActivated: false },
    SatelliteModel: RentalManagement,
    satelliteLabel: 'RentalManagement',
  });
  return { property, rental: satellite };
}

/**
 * @returns {Promise<{property, rental}>}
 */
async function updateFullRentalProperty({ property, rentalData, actingUser }) {
  const { satellite } = await updateFullPropertyTransaction({
    property,
    // `managementActivated` volontairement absent ici : une simple édition de
    // fiche ne doit jamais changer le statut d'activation d'un dossier
    // existant (qu'il soit déjà activé ou non).
    satelliteData: { ...rentalData, owner: property.owner },
    satelliteCreateExtra: { manager: actingUser.id, managementActivated: false },
    SatelliteModel: RentalManagement,
  });
  return { property, rental: satellite };
}

module.exports = { createFullRentalProperty, updateFullRentalProperty };
