// F-U1.H / F-U1.I — Attestation d'identité humaine (preuve d'indépendance).
//
// Délivrée UNIQUEMENT par un agent Altitude Vision habilité au terme d'un
// dossier KYC (`source: KYC_CASE`), ou lors du bootstrap racine hors ligne
// (`BOOTSTRAP_OFFLINE`). Rattache un compte à une identité réelle sans stocker
// le numéro : empreinte HMAC versionnée (`identityKey`, `fingerprintKeyVersion`).
// Deux comptes portant la même empreinte (même version de clé) appartiennent à
// la même personne. Deux téléphones différents ne prouvent rien.
//
// Utilisable seulement si `verified` et non expirée (date d'expiration de la
// pièce). Suspendue, révoquée ou expirée, elle rend immédiatement inutilisables
// les habilitations qui la citent dans leur `identityBasis`.

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  user: { type: ObjectId, ref: 'User', required: true },
  identityKey: { type: String, required: true, select: false, index: true },
  fingerprintKeyVersion: { type: String, required: true, default: 'v1', select: false },
  documentKind: { type: String, enum: C.IDENTITY_DOCUMENT_KINDS, required: true },
  source: { type: String, enum: ['KYC_CASE', 'BOOTSTRAP_OFFLINE'], required: true, default: 'KYC_CASE' },
  kycCase: { type: ObjectId, ref: 'FinancialIdentityKycCase', default: null },
  status: { type: String, enum: ['verified', 'suspended', 'revoked'], default: 'verified', index: true },
  expiresAt: { type: Date, default: null },
  evidenceRef: { type: String, required: true, trim: true, maxlength: 300 },
  verifiedBy: { type: ObjectId, ref: 'User', required: true },
  verifiedAt: { type: Date, required: true },
  suspendedBy: { type: ObjectId, ref: 'User', default: null },
  suspendedAt: { type: Date, default: null },
  revokedBy: { type: ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  statusReason: { type: String, trim: true, maxlength: 1000 },
  statusHistory: [{ _id: false, from: String, to: String, actor: { type: ObjectId, ref: 'User' }, reason: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true });

// Une seule attestation vivante (vérifiée ou suspendue) par compte.
schema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['verified', 'suspended'] } } });

schema.statics.usableFilter = (now = new Date()) => ({ status: 'verified', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] });

module.exports = mongoose.model('HumanIdentityAttestation', schema);
