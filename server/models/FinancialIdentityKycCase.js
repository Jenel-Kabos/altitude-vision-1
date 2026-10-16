// F-U1.I — Dossier KYC financier.
//
// Préparé par la personne concernée ou par son organisation (niveau 1),
// examiné et décidé exclusivement par un agent Altitude Vision habilité
// (niveau 2). Minimisation : aucun numéro de pièce en clair (empreinte HMAC
// versionnée + 3 derniers caractères), justificatifs stockés en privé
// (référence `privateAssetSchema`, jamais d'URL publique), références de
// stockage non sélectionnées par défaut.

const mongoose = require('mongoose');
const K = require('../constants/financialKycConstants');
const privateAssetSchema = require('./schemas/privateAssetSchema');

const ObjectId = mongoose.Schema.Types.ObjectId;

const documentSchema = new mongoose.Schema({
  docId: { type: String, required: true },
  slot: { type: String, required: true },
  asset: { type: privateAssetSchema, select: false },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 1 },
  sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  uploadedBy: { type: ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, required: true },
  status: { type: String, enum: ['current', 'superseded'], default: 'current' },
  purgedAt: { type: Date, default: null },
  review: {
    result: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    notes: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
}, { _id: false });

const historySchema = new mongoose.Schema({
  action: { type: String, required: true },
  from: { type: String, default: null },
  to: { type: String, default: null },
  actor: { type: ObjectId, ref: 'User', default: null },
  reason: { type: String, trim: true, maxlength: 2000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  subject: { type: ObjectId, ref: 'User', required: true, index: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  applicantType: { type: String, enum: Object.values(K.KYC_APPLICANT_TYPES), required: true },
  purpose: { type: String, enum: Object.values(K.KYC_PURPOSES), required: true },
  procedureVersion: { type: String, required: true },
  status: { type: String, enum: Object.values(K.KYC_CASE_STATUSES), required: true, index: true },
  revision: { type: Number, default: 0, min: 0 },
  personal: {
    lastName: { type: String, trim: true, maxlength: 100 },
    firstNames: { type: String, trim: true, maxlength: 150 },
    birthDate: { type: Date, default: null },
  },
  identityDocument: {
    kind: { type: String, enum: [...Object.keys(K.KYC_PROCEDURE.acceptedDocuments), null], default: null },
    issuingCountry: { type: String, trim: true, uppercase: true, match: /^[A-Z]{2}$/ },
    expiresAt: { type: Date, default: null },
    numberFingerprint: { type: String, select: false },
    fingerprintKeyVersion: { type: String, select: false },
    numberHint: { type: String, trim: true, maxlength: 3 },
  },
  documents: { type: [documentSchema], default: [] },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  preparedByTenant: { type: Boolean, required: true },
  privacyNoticeVersion: { type: String, default: null },
  submittedBy: { type: ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: null },
  reviewer: { type: ObjectId, ref: 'User', default: null },
  reviewStartedAt: { type: Date, default: null },
  informationRequests: [{
    _id: false, requestedBy: { type: ObjectId, ref: 'User' }, requestedAt: Date,
    message: { type: String, trim: true, maxlength: 2000 }, items: [String], resolvedAt: Date,
  }],
  decision: {
    result: { type: String, enum: ['approved', 'rejected', null], default: null },
    decidedBy: { type: ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    reason: { type: String, trim: true, maxlength: 2000 },
    linkedAccountsDetected: { type: Number, default: 0 },
  },
  attestation: { type: ObjectId, ref: 'HumanIdentityAttestation', default: null },
  // F-U1.J — conservation : départ du délai à la clôture ; gel légal possible.
  retention: {
    closedAt: { type: Date, default: null },
    legalHold: {
      active: { type: Boolean, default: false },
      reason: { type: String, trim: true, maxlength: 1000 },
      setBy: { type: ObjectId, ref: 'User', default: null },
      setAt: { type: Date, default: null },
    },
  },
  erasureRequests: [{
    _id: false, requestedBy: { type: ObjectId, ref: 'User' }, requestedAt: Date,
    reason: { type: String, trim: true, maxlength: 1000 }, status: { type: String, enum: ['pending_legal_review'], default: 'pending_legal_review' },
  }],
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

// Un seul dossier ouvert par personne et par finalité.
schema.index(
  { subject: 1, purpose: 1 },
  { unique: true, partialFilterExpression: { status: { $in: K.KYC_OPEN_STATUSES } } },
);

module.exports = mongoose.model('FinancialIdentityKycCase', schema);
