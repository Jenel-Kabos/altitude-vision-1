// server/models/SaleManagement.js
//
// Sprint A (séparation Vente/Location) : satellite 1-1 de Property pour les
// informations propres à la vente — même pattern que RentalManagement pour
// la location et Accommodation pour l'hébergement. Property reste la source
// de vérité pour le prix affiché (`price`), les honoraires (`honoraires`)
// et les frais de visite (`fraisVisite`), déjà génériques Vente/Location —
// non dupliqués ici.
//
// Volontairement plus simple que RentalManagement : une vente n'a pas de
// cycle de vie locataire/bail/préavis à suivre — seulement des informations
// juridiques/commerciales et un statut de publication. Pas de documents
// juridiques stockés en clair (seulement des indicateurs booléens/texte
// libre) — voir server/docs/PROPERTY_TRANSACTION_ARCHITECTURE.md.

const mongoose = require('mongoose');

const saleManagementSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'SaleManagement doit référencer un Property.'],
      unique: true,
      index: true,
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    negotiable: { type: Boolean, default: false },

    // Type de document de propriété — texte libre volontairement (titre
    // foncier, permis urbain, attestation villageoise… la diversité réelle
    // des situations foncières locales ne doit pas être figée dans une enum
    // inventée sans validation métier).
    ownershipDocumentType: { type: String, trim: true, default: '' },
    // Indicateur seulement — jamais le document lui-même (pas d'upload de
    // pièce juridique dans ce sprint, aucune architecture de stockage
    // sécurisé dédiée n'existe encore pour ça).
    ownershipDocumentAvailable: { type: Boolean, default: false },

    legalStatus: {
      type: String,
      enum: ['regularise', 'en_cours_regularisation', 'litigieux', 'non_renseigne'],
      default: 'non_renseigne',
    },

    financingAccepted: { type: Boolean, default: false },
    // Commission d'agence en pourcentage — distincte de Property.honoraires
    // (montant forfaitaire déjà partagé Vente/Location).
    agencyCommission: { type: Number, min: 0, max: 100, default: null },
    sellerConditions: { type: String, trim: true, default: '' },

    publicationStatus: {
      type: String,
      enum: ['brouillon', 'en_attente_moderation', 'publie', 'suspendu', 'archive', 'rejete'],
      default: 'brouillon',
      index: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SaleManagement', saleManagementSchema);
