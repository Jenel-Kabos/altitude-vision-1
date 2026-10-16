// F-U2.13 — Consentement électronique du locataire à une version de politique.
// Deux étapes : présentation (document + empreinte + jeton à usage unique),
// puis acceptation explicite par le locataire authentifié. Une acceptation
// authentifiée n'est pas une signature électronique qualifiée :
// `signatureStatus = SIGNATURE_PENDING` tant qu'aucun dispositif conforme n'existe.

const mongoose = require('mongoose');
const { CONSENT_STATUSES } = require('../constants/leasePolicyConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  policy: { type: ObjectId, ref: 'LeaseContractualPolicy', required: true },
  lease: { type: ObjectId, ref: 'Contrat', required: true },
  policyVersion: { type: Number, required: true },
  signer: { type: ObjectId, ref: 'User', required: true },
  signerRole: { type: String, enum: ['LOCATAIRE'], required: true },
  locataire: { type: ObjectId, ref: 'Locataire', required: true },
  documentHash: { type: String, required: true },
  status: { type: String, enum: CONSENT_STATUSES, required: true },
  presentation: { tokenHash: { type: String, required: true, select: false }, presentedAt: { type: Date, required: true }, expiresAt: { type: Date, required: true } },
  acceptedAt: { type: Date, default: null },
  explicitAction: { type: String, enum: ['EXPLICIT_ACCEPT', null], default: null },
  authenticationMethod: { type: String, default: 'AUTHENTICATED_SESSION' },
  verificationStatus: { type: String, enum: ['AUTHENTICATED_ACCEPTANCE', null], default: null },
  signatureStatus: { type: String, enum: ['SIGNATURE_PENDING', 'SIGNED'], default: 'SIGNATURE_PENDING' },
  history: [{ _id: false, action: String, actor: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
}, { timestamps: true });

schema.index({ policy: 1, signer: 1 }, { unique: true });

// Preuve acceptée : jamais réécrite.
schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function guard(next) {
  const filter = this.getFilter() || {};
  if (filter.status !== 'PRESENTED') {
    const error = new Error('Une preuve de consentement ne peut pas être modifiée.'); error.code = 'CONSENT_IMMUTABLE'; error.statusCode = 409; return next(error);
  }
  return next();
});

module.exports = mongoose.model('LeasePolicyConsent', schema);
