// F-U2.10 — Dossier de recouvrement d'une échéance de loyer, ouvert au 25 du
// mois suivant la facturation. Projet de mise en demeure uniquement : aucun
// envoi réel tant que la validation juridique (modèle, émetteur habilité,
// mandat, canal, délais, preuve de remise) n'est pas disponible.

const mongoose = require('mongoose');
const { COLLECTION_CASE_STATUSES } = require('../constants/rentCollectionConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  rentDocument: { type: ObjectId, ref: 'FinancialDocument', required: true },
  reference: { type: String, required: true },
  lease: { type: ObjectId, ref: 'Contrat', default: null },
  property: { type: ObjectId, ref: 'Property', required: true },
  owner: { type: ObjectId, ref: 'User', default: null },
  locataire: { type: ObjectId, ref: 'Locataire', default: null },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  scope: { mandataryType: String, tenant: { type: ObjectId, default: null } },
  period: { type: String, required: true },
  formalNoticeDate: { type: Date, required: true },
  status: { type: String, enum: COLLECTION_CASE_STATUSES, default: 'evaluating', index: true },
  evaluation: {
    at: Date, rentPrincipalMinor: Number, paidRentMinor: Number, unpaidRentMinor: Number,
    penaltyMinor: Number, penaltyStatus: String, leaseStatus: String,
  },
  // F-U2.13 — procédure non applicable faute de politique opposable (ex. consentement absent).
  block: { reason: { type: String, default: null }, at: { type: Date, default: null } },
  policy: { id: { type: ObjectId, default: null }, type: { type: String, default: null }, version: { type: Number, default: null } },
  suspension: { reason: String, report: { type: ObjectId, ref: 'RentPaymentDifficultyReport', default: null }, at: Date },
  noticeDraft: {
    preparedAt: Date, policyVersion: String, legalValidation: { type: String, default: 'NOT_VALIDATED' },
    sendable: { type: Boolean, default: false }, sent: { type: Boolean, default: false },
    content: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  history: [{ _id: false, action: String, actor: { type: ObjectId, ref: 'User', default: null }, at: { type: Date, default: Date.now }, reason: String }],
}, { timestamps: true });

schema.index({ rentDocument: 1 }, { unique: true });
schema.index({ owner: 1, period: -1 });
schema.index({ 'scope.mandataryType': 1, 'scope.tenant': 1, status: 1 });

module.exports = mongoose.model('RentCollectionCase', schema);
