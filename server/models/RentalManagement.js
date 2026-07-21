// server/models/RentalManagement.js
//
// Sprint A (séparation Vente/Location) : ce modèle devient la source unique
// de vérité pour les règles métier propres à la location (bail), à la fois
// pour le workflow de gestion locative active (déjà existant : locataire,
// bail, préavis, sortie) ET pour les champs de FICHE d'annonce ajoutés ici
// (minimumLeaseMonths, availableFrom, petsAllowed, rentalConditions,
// chargesIncluded, furnished, cautionMultiplicateur,
// profilsLocataireRecherches, documentsRequis).
//
// `Property.honoraires`/`Property.fraisVisite` restent partagés Vente/
// Location (déjà génériques, comme bedrooms/bathrooms le sont pour
// Accommodation) — pas dupliqués ici.
//
// IMPORTANT (compatibilité) : `Property.cautionMultiplicateur`,
// `Property.profilsLocataireRecherches` et `Property.documentsRequis`
// existent ENCORE sur le schéma Property (annonces historiques créées avant
// ce sprint, et flux legacy non touchés : POST/PUT /api/properties,
// OwnerPropertyManagement.jsx). Ce sprint n'y touche PAS — voir
// server/docs/PROPERTY_TRANSACTION_ARCHITECTURE.md ("Compatibilité legacy").
// Seul le NOUVEAU flux admin (POST/PUT /api/admin/properties/rentals) écrit
// désormais ces informations ici plutôt que sur Property. Une migration
// complète (retrait de ces champs de Property) est un chantier séparé,
// prévu au Sprint F ("Migration et nettoyage"), après audit de tous les
// points de lecture restants.

const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  from: String,
  to: String,
  action: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  source: { type: String, default: 'api' },
  comment: { type: String, trim: true, maxlength: 1000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const actionRequestSchema = new mongoose.Schema({
  type: { type: String, enum: ['publish', 'suspend', 'maintenance', 'future_availability'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedAt: { type: Date, default: Date.now },
  reason: { type: String, trim: true, maxlength: 1000 },
  plannedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewComment: { type: String, trim: true, maxlength: 1000 },
});

const rentalManagementSchema = new mongoose.Schema({
  // Property reste l'unique représentation du bien physique et de son annonce.
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, unique: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  currentTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Locataire', default: null },
  activeLease: { type: mongoose.Schema.Types.ObjectId, ref: 'Contrat', default: null },
  active: { type: Boolean, default: true, index: true },
  // Distingue une simple fiche d'annonce (créée via le nouveau flux
  // POST /api/rental-properties, Sprint A) d'un dossier de gestion locative
  // réellement activé par le staff (via POST /api/rental-management, ou
  // implicitement dès qu'un Contrat de bail est créé — voir
  // contratController.syncLeaseOccupation). `default: true` pour que les
  // documents historiques (créés avant ce champ, donc absents en base) soient
  // hydratés comme activés par Mongoose — comportement inchangé pour eux ;
  // seul le nouveau flux listing-only le force explicitement à `false`.
  managementActivated: { type: Boolean, default: true, index: true },
  occupancyStatus: {
    type: String,
    enum: ['vacant', 'preavis', 'occupe', 'sortie_programmee', 'travaux', 'indisponible'],
    default: 'vacant',
    index: true,
  },
  availabilityStatus: {
    type: String,
    enum: ['disponible', 'reserve', 'loue', 'indisponible', 'maintenance', 'retire', 'vendu'],
    default: 'disponible',
    index: true,
  },
  publicationStatus: {
    type: String,
    enum: ['brouillon', 'en_attente_moderation', 'publie', 'suspendu', 'archive', 'rejete'],
    default: 'brouillon',
    index: true,
  },
  publicationPolicy: { type: String, enum: ['manuelle', 'automatique'], default: 'manuelle' },
  publicationAuthorized: { type: Boolean, default: false },
  monthlyRent: { type: Number, min: 0 },
  charges: { type: Number, min: 0, default: 0 },
  depositAmount: { type: Number, min: 0 },
  managementFee: { type: Number, min: 0 },
  mandateStartAt: Date,
  mandateEndAt: Date,

  // ─── Champs de fiche d'annonce (Sprint A) ──────────────────────
  chargesIncluded: { type: Boolean, default: false },
  furnished: { type: Boolean, default: false },
  minimumLeaseMonths: { type: Number, min: 1, default: 12 },
  availableFrom: { type: Date, default: null },
  petsAllowed: { type: Boolean, default: false },
  rentalConditions: { type: String, trim: true, default: '' },
  // Multiplicateur de loyer mensuel (ex : 2 = 2x le loyer) — même convention
  // que l'actuel Property.cautionMultiplicateur ; montant réel calculé à
  // l'affichage (monthlyRent * cautionMultiplicateur), jamais stocké en clair.
  cautionMultiplicateur: { type: Number, min: 0, max: 6, default: 2 },
  profilsLocataireRecherches: {
    type: [String],
    enum: ['Salarié', 'Étudiant', 'Indépendant/Affairiste', 'Fonctionnaire', 'Retraité'],
    default: [],
  },
  documentsRequis: {
    type: [String],
    enum: [
      'CNI',
      'Justificatif de revenus',
      '2 derniers bulletins de salaire',
      'Caution bancaire',
      'Attestation de travail',
      'Quittance de loyer précédente',
    ],
    default: [],
  },
  lastPublishedAt: Date,
  lastVacatedAt: Date,
  maintenanceStatus: { type: String, enum: ['aucune', 'signalee', 'en_cours', 'controle_requis'], default: 'aucune' },
  maintenanceReason: { type: String, trim: true, maxlength: 1000 },
  noticeStartedAt: Date,
  plannedExitAt: Date,
  exitInspectionClearedAt: Date,
  publicationReadiness: {
    ready: { type: Boolean, default: false },
    missingFields: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    evaluatedAt: Date,
  },
  workflowHistory: { type: [historySchema], default: [] },
  actionRequests: { type: [actionRequestSchema], default: [] },
}, { timestamps: true });

rentalManagementSchema.index({ owner: 1, occupancyStatus: 1 });
rentalManagementSchema.index({ publicationStatus: 1, availabilityStatus: 1 });

module.exports = mongoose.model('RentalManagement', rentalManagementSchema);
