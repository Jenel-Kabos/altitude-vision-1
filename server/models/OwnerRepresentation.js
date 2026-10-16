// F-U1.G — Représentant habilité d'un propriétaire.
//
// Une représentation lie un représentant (User) à un propriétaire, pour une
// liste EXPLICITE de mandats et de pouvoirs, sur une durée bornée.
//   - OWNER_IN_APP : désignée par le propriétaire authentifié → active.
//   - WRITTEN_PROXY : procuration papier enregistrée par un agent →
//     pending_verification, active seulement après vérification par une
//     personne habilitée distincte.
// Un représentant ne peut pas sous-déléguer et n'agit jamais hors de sa portée.

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  owner: { type: ObjectId, ref: 'User', required: true, index: true },
  representative: { type: ObjectId, ref: 'User', required: true, index: true },
  mandates: { type: [{ type: ObjectId, ref: 'ManagementMandate' }], required: true },
  powers: [{ type: String, enum: Object.values(C.OWNER_POWERS), required: true }],
  status: { type: String, enum: Object.values(C.REPRESENTATION_STATUSES), required: true, index: true },
  source: { type: String, enum: Object.values(C.REPRESENTATION_SOURCES), required: true },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  proxyDocument: {
    documentRef: { type: String, trim: true, maxlength: 300 },
    sha256: { type: String, trim: true },
    signedAt: Date,
  },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  verifiedBy: { type: ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  verificationMethod: { type: String, trim: true, maxlength: 300 },
  revokedBy: { type: ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  statusReason: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

schema.path('mandates').validate((value) => Array.isArray(value) && value.length > 0, 'Au moins un mandat doit être désigné.');
schema.path('powers').validate((value) => Array.isArray(value) && value.length > 0, 'Au moins un pouvoir doit être désigné.');
schema.index({ owner: 1, representative: 1, status: 1 });

module.exports = mongoose.model('OwnerRepresentation', schema);
