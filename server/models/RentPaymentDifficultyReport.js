// F-U2.10 — Signalement d'une difficulté de paiement par le locataire.
// Date de déclaration fixée par le serveur (aucun antidatage). Recevable pour
// la suspension de la mise en demeure s'il est enregistré avant le 25 du mois
// suivant la facturation, ou sur décision explicite d'un gestionnaire habilité.
// N'annule ni la dette, ni la pénalité, et n'accorde aucun report automatique.

const mongoose = require('mongoose');
const { DIFFICULTY_REPORT_STATUSES } = require('../constants/rentCollectionConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  rentDocument: { type: ObjectId, ref: 'FinancialDocument', required: true },
  lease: { type: ObjectId, ref: 'Contrat', required: true },
  property: { type: ObjectId, ref: 'Property', required: true },
  owner: { type: ObjectId, ref: 'User', default: null },
  locataire: { type: ObjectId, ref: 'Locataire', required: true },
  reportedBy: { type: ObjectId, ref: 'User', required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  scope: { mandataryType: String, tenant: { type: ObjectId, default: null } },
  period: { type: String, required: true },
  declaredAt: { type: Date, required: true },
  formalNoticeDate: { type: Date, default: null },
  reason: { type: String, trim: true, maxlength: 1000, default: null },
  proposedPaymentDate: { type: Date, default: null },
  status: { type: String, enum: DIFFICULTY_REPORT_STATUSES, default: 'submitted', index: true },
  admissibleForSuspension: { type: Boolean, required: true },
  admissibilityBasis: { type: String, enum: ['DECLARED_BEFORE_25', 'MANAGER_EXCEPTION', 'LATE_DECLARATION', 'NOT_APPLICABLE'], required: true },
  approvedPaymentDate: { type: Date, default: null },
  history: [{ _id: false, action: String, actor: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, reason: String }],
}, { timestamps: true });

schema.index({ rentDocument: 1, locataire: 1 }, { unique: true });
schema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('RentPaymentDifficultyReport', schema);
