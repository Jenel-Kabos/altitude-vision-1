// server/models/ActionLog.js
const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'OrgUnit', default: null, index: true },
  action: {
    type:     String,
    required: true,
    trim:     true,
  },
  description: {
    type:     String,
    required: true,
    trim:     true,
  },
  module: {
    type: String,
    enum: [
      'Altimmo','MilaEvents','Altcom','GestionLocative',
      'Utilisateurs','Actualites','Portfolio','Devis',
      'Messagerie','Dashboard','Hotel',
      'Organisation', // ORGANIZATION-1 — ajout additif, aucune valeur retirée.
      'PlatformAdmin', // PLATFORM-ADMIN-1 — ajout additif, aucune valeur retirée.
    ],
  },
  // PLATFORM-ADMIN-1 — additif, `null` pour toute action antérieure/non
  // concernée. Distingue une action effectuée par un opérateur en contexte
  // plateforme (aucun tenant sélectionné, ex. gestion des tenants/opérateurs
  // eux-mêmes) d'une action en contexte tenant (opérateur ou Tenant Admin
  // agissant sur un tenant précis, déjà couvert par le champ `tenant`
  // ci-dessus).
  scopeMode: {
    type: String,
    enum: ['tenant', 'platform', null],
    default: null,
  },
  auteur: {
    id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nom:   { type: String },
    role:  { type: String },
    email: { type: String },
  },
  cible: {
    id:   { type: String },
    type: { type: String },
    nom:  { type: String },
  },
  typeAction: {
    type: String,
    enum: [
      'CRÉATION','MODIFICATION','SUPPRESSION','VALIDATION',
      'REJET','CONNEXION','DÉCONNEXION','PAIEMENT',
      'GÉNÉRATION_PDF','ENVOI_EMAIL','CHANGEMENT_RÔLE','UPLOAD_PHOTO',
    ],
  },
  metadata: {
    ancienneValeur: { type: String },
    nouvelleValeur: { type: String },
    ip:             { type: String },
    userAgent:      { type: String },
    // TENANT-DATA-REGULARIZATION-EXEC-1 — enveloppe structurée sans
    // secrets, utilisée comme checkpoint append-only et clé d'idempotence.
    regularization: {
      batchId: { type: String, default: null },
      resourceType: { type: String, default: null },
      resourceId: { type: String, default: null },
      classification: { type: String, enum: ['A', null], default: null },
      proofs: { type: [String], default: undefined },
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null },
      fingerprintBefore: { type: String, default: null },
      manifestHash: { type: String, default: null },
      reason: { type: String, default: null },
      operation: { type: String, enum: ['apply', 'rollback', null], default: null },
    },
  },
  date: {
    type:    Date,
    default: Date.now,
  },
});

actionLogSchema.index({ date:        -1            });
actionLogSchema.index({ module:       1, date: -1  });
actionLogSchema.index({ typeAction:   1, date: -1  });
actionLogSchema.index({ 'auteur.id':  1, date: -1  });
actionLogSchema.index(
  { 'metadata.regularization.batchId': 1, 'metadata.regularization.resourceType': 1, 'metadata.regularization.resourceId': 1, 'metadata.regularization.operation': 1 },
  { unique: true, partialFilterExpression: { 'metadata.regularization.batchId': { $type: 'string' } } },
);

module.exports = mongoose.model('ActionLog', actionLogSchema);
