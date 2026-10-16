// F-U1.C — Décision du propriétaire sur une dépense exceptionnelle.
//
// Historique immuable (append-only) : chaque décision ou tentative
// d'enregistrement d'autorisation écrite est un document distinct.
//   - IN_APP : le propriétaire authentifié décide lui-même (decidedBy = owner).
//   - VERIFIED_WRITTEN : en deux temps (F-U1.G) — un agent SOUMET l'écrit
//     (phase WRITTEN_SUBMISSION, jamais effective), puis une personne habilitée
//     distincte l'AUTHENTIFIE (phase WRITTEN_AUTHENTICATION). Seule une
//     authentification `verified` peut débloquer la dépense.
// `decidedBy` est la personne qui agit ; `onBehalfOf` le propriétaire ;
// `representation` la procuration utilisée le cas échéant.
// Une autorisation couvre UNE dépense (bien + intervention + mandat), jamais
// les interventions suivantes.

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');
const appendOnlyPlugin = require('./schemas/appendOnlyPlugin');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  expense: { type: ObjectId, ref: 'MandateExpense', required: true, index: true },
  mandate: { type: ObjectId, ref: 'ManagementMandate', required: true },
  property: { type: ObjectId, ref: 'Property', required: true },
  intervention: { type: ObjectId, ref: 'RentalMaintenanceTicket', required: true },
  owner: { type: ObjectId, ref: 'User', required: true },
  mode: { type: String, enum: Object.values(C.EXPENSE_AUTHORIZATION_MODES), required: true },
  phase: { type: String, enum: ['DECISION', 'WRITTEN_SUBMISSION', 'WRITTEN_AUTHENTICATION'], required: true },
  submission: { type: ObjectId, ref: 'ExpenseAuthorization', default: null },
  onBehalfOf: { type: ObjectId, ref: 'User', required: true },
  representation: { type: ObjectId, ref: 'OwnerRepresentation', default: null },
  decision: { type: String, enum: ['approved', 'refused'], required: true },
  maxAmountMinor: { type: Number, min: 0, default: null },
  currency: { type: String, required: true },
  decidedBy: { type: ObjectId, ref: 'User', required: true },
  decidedAt: { type: Date, required: true },
  written: {
    documentRef: { type: String, trim: true, maxlength: 300 },
    sha256: { type: String, trim: true },
    signedAt: Date,
    signatoryName: { type: String, trim: true, maxlength: 200 },
    signatory: { type: String, enum: ['OWNER', 'REPRESENTATIVE'] },
    signatoryRepresentation: { type: ObjectId, ref: 'OwnerRepresentation', default: null },
    verification: {
      result: { type: String, enum: C.WRITTEN_AUTHORIZATION_VERIFICATION_RESULTS },
      method: { type: String, trim: true, maxlength: 300 },
      notes: { type: String, trim: true, maxlength: 2000 },
      verifiedBy: { type: ObjectId, ref: 'User' },
      verifiedAt: Date,
    },
  },
  effective: { type: Boolean, required: true },
  comment: { type: String, trim: true, maxlength: 2000 },
}, { timestamps: { createdAt: true, updatedAt: false } });

schema.path('maxAmountMinor').validate((value) => value == null || Number.isSafeInteger(value), 'maxAmountMinor doit être un entier sûr.');
// Une soumission écrite ne peut être authentifiée qu'une seule fois.
schema.index({ submission: 1 }, { unique: true, partialFilterExpression: { phase: 'WRITTEN_AUTHENTICATION' } });
appendOnlyPlugin(schema, { errorCode: 'EXPENSE_AUTHORIZATION_IMMUTABLE' });

module.exports = mongoose.model('ExpenseAuthorization', schema);
