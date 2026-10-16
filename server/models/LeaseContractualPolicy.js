// F-U2.13 — Politique contractuelle versionnée d'un bail. Une version n'est
// jamais modifiée : une nouvelle version prend effet à une date future (ou au
// début du mois courant), la précédente reste applicable aux périodes passées.

const mongoose = require('mongoose');
const { POLICY_TYPES } = require('../constants/leasePolicyConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  lease: { type: ObjectId, ref: 'Contrat', required: true },
  property: { type: ObjectId, ref: 'Property', required: true },
  owner: { type: ObjectId, ref: 'User', default: null },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  mandate: { type: ObjectId, ref: 'ManagementMandate', default: null },
  type: { type: String, enum: Object.values(POLICY_TYPES), required: true },
  version: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['active', 'superseded'], default: 'active' },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date, default: null },
  terms: { type: mongoose.Schema.Types.Mixed, required: true },
  termsHash: { type: String, required: true },
  policyLabel: { type: String, default: null },
  documentReference: { type: String, trim: true, maxlength: 500, required: true },
  documentHash: { type: String, required: true },
  consentRequired: { type: Boolean, required: true },
  validation: { status: { type: String, enum: ['COMMERCIALLY_VALIDATED', 'DECLARED_BY_OWNER'], required: true }, legalStatus: { type: String, default: 'NOT_VALIDATED' } },
  // Bail autonome : preuve d'acceptation éventuellement déclarée par le bailleur (non vérifiée).
  ownerRecordedAcceptance: { reference: { type: String, default: null }, date: { type: Date, default: null }, recordedBy: { type: ObjectId, ref: 'User', default: null } },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  authorityPlane: { type: String, required: true },
  history: [{ _id: false, action: String, actor: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, reason: String }],
}, { timestamps: true });

schema.index({ lease: 1, version: 1 }, { unique: true });
schema.index({ lease: 1, effectiveFrom: -1 });

// Garde-fou : contenu contractuel d'une version immuable.
const IMMUTABLE = ['terms', 'termsHash', 'type', 'version', 'effectiveFrom', 'lease', 'documentHash', 'documentReference', 'mandate'];
function rejectContentChange(next) {
  const update = this.getUpdate() || {};
  const fields = [...Object.keys(update.$set || {}), ...Object.keys(update).filter((k) => !k.startsWith('$'))];
  if (fields.some((field) => IMMUTABLE.some((path) => field === path || field.startsWith(`${path}.`)))) {
    const error = new Error('Une version de politique contractuelle est immuable.'); error.code = 'LEASE_POLICY_IMMUTABLE'; error.statusCode = 409; return next(error);
  }
  return next();
}
schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], rejectContentChange);

module.exports = mongoose.model('LeaseContractualPolicy', schema);
