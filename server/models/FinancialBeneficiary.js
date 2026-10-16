// F-U1.D — Bénéficiaire financier (destinataire d'un futur reversement ou
// compte vérifié du propriétaire en paiement direct).
//
// Minimisation des données : aucun numéro complet n'est stocké. Seuls un
// identifiant masqué (affichage) et une empreinte HMAC (détection de doublon)
// sont conservés. La conservation des coordonnées complètes nécessaires à un
// paiement sortant réel relève d'une décision ultérieure (coffre / jeton
// prestataire) : tant qu'elle n'est pas prise, aucun reversement n'est
// exécutable.

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const evidenceSchema = new mongoose.Schema({
  documentRef: { type: String, required: true, trim: true, maxlength: 300 },
  sha256: { type: String, trim: true, match: /^[a-f0-9]{64}$/ },
  label: { type: String, trim: true, maxlength: 200 },
}, { _id: false });

const schema = new mongoose.Schema({
  mandataryType: { type: String, enum: Object.values(C.MANDATARY_TYPES), required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  owner: { type: ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: Object.values(C.BENEFICIARY_KINDS), required: true },
  holderName: { type: String, required: true, trim: true, maxlength: 200 },
  institution: { type: String, required: true, trim: true, maxlength: 120 },
  maskedIdentifier: { type: String, required: true, trim: true, maxlength: 40 },
  accountFingerprint: { type: String, required: true, select: false },
  status: { type: String, enum: Object.values(C.BENEFICIARY_STATUSES), default: C.BENEFICIARY_STATUSES.PENDING_VERIFICATION, index: true },
  evidence: { type: [evidenceSchema], default: [] },
  registeredBy: { type: ObjectId, ref: 'User', required: true },
  verifiedBy: { type: ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  verificationMethod: { type: String, trim: true, maxlength: 200 },
  rejectedBy: { type: ObjectId, ref: 'User', default: null },
  rejectedAt: { type: Date, default: null },
  revokedBy: { type: ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  statusReason: { type: String, trim: true, maxlength: 1000 },
  statusHistory: [{
    _id: false, from: String, to: String, action: String,
    actor: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

schema.path('tenant').validate(function tenantMatchesMandatary(value) {
  return this.mandataryType === C.MANDATARY_TYPES.TENANT ? Boolean(value) : value == null;
}, 'tenant est requis pour un mandataire TENANT et interdit pour un mandataire PLATFORM.');

schema.index(
  { owner: 1, accountFingerprint: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending_verification', 'verified'] } } },
);

module.exports = mongoose.model('FinancialBeneficiary', schema);
