// F-U2.12 — Encaissement direct d'un loyer par un bailleur (hors plateforme).
// Déclaration ≠ confirmation : le paiement déclaré sert au SUIVI locatif
// (dette, pénalité, recouvrement) ; seul un encaissement CONFIRMÉ par un
// contrôle indépendant (confirmation du locataire ou revue plateforme
// habilitée) entre dans la base des frais de 1 %. Le bailleur ne confirme
// jamais lui-même. Preuves : RÉFÉRENCES vérifiables uniquement (aucun fichier :
// le stockage de justificatifs financiers n'est pas admissible à ce stade).

const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;
const RECEIPT_STATUSES = ['DECLARED', 'EVIDENCE_SUBMITTED', 'UNDER_REVIEW', 'CONFIRMED', 'CONTESTED', 'CANCELLED'];
const EVIDENCE_KINDS = ['PROVIDER_REFERENCE', 'MOBILE_MONEY_REFERENCE', 'BANK_REFERENCE', 'OTHER_REFERENCE'];

const schema = new mongoose.Schema({
  payment: { type: ObjectId, ref: 'FinancialPayment', required: true },
  document: { type: ObjectId, ref: 'FinancialDocument', required: true },
  lease: { type: ObjectId, ref: 'Contrat', default: null },
  property: { type: ObjectId, ref: 'Property', required: true },
  owner: { type: ObjectId, ref: 'User', required: true, index: true },
  locataire: { type: ObjectId, ref: 'Locataire', default: null },
  amountMinor: { type: Number, required: true, min: 1 },
  receivedAt: { type: Date, required: true },
  status: { type: String, enum: RECEIPT_STATUSES, default: 'DECLARED', index: true },
  evidence: [{ _id: false, kind: { type: String, enum: EVIDENCE_KINDS }, reference: String, submittedAt: Date, submittedBy: { type: ObjectId, ref: 'User' } }],
  // Clés normalisées « type:référence » : une transaction ne justifie qu'un seul encaissement.
  evidenceKeys: { type: [String], default: undefined },
  confirmation: { basis: { type: String, enum: ['TENANT_CONFIRMATION', 'PLATFORM_REVIEW', null], default: null }, by: { type: ObjectId, ref: 'User', default: null }, at: { type: Date, default: null }, note: { type: String, default: null } },
  contest: { by: { type: ObjectId, ref: 'User', default: null }, at: { type: Date, default: null }, reason: { type: String, default: null } },
  cancellation: { by: { type: ObjectId, ref: 'User', default: null }, at: { type: Date, default: null }, reason: { type: String, default: null } },
  history: [{ _id: false, action: String, actor: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, reason: String }],
}, { timestamps: true });

schema.path('amountMinor').validate(Number.isSafeInteger, 'amountMinor doit être un entier.');
schema.index({ payment: 1 }, { unique: true });
schema.index({ evidenceKeys: 1 }, { unique: true, partialFilterExpression: { evidenceKeys: { $exists: true } } });

module.exports = mongoose.model('DirectRentReceipt', schema);
module.exports.RECEIPT_STATUSES = RECEIPT_STATUSES;
module.exports.EVIDENCE_KINDS = EVIDENCE_KINDS;
