// F-U1.B — Version immuable des clauses financières d'un mandat.
//
// `terms` est le résultat normalisé de mandateTermsService.normalizeMandateTerms
// et `termsHash` son empreinte canonique. Chaque opération financière recopie
// (versionId, termsHash, terms) : une version ultérieure ne recalcule jamais
// une opération déjà enregistrée.

const mongoose = require('mongoose');
const appendOnlyPlugin = require('./schemas/appendOnlyPlugin');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  mandate: { type: ObjectId, ref: 'ManagementMandate', required: true },
  versionNumber: { type: Number, required: true, min: 1 },
  terms: { type: mongoose.Schema.Types.Mixed, required: true },
  termsHash: { type: String, required: true },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date, default: null },
  supersedes: { type: ObjectId, ref: 'ManagementMandateVersion', default: null },
  amendmentReason: { type: String, trim: true, maxlength: 1000 },
  createdBy: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, minimize: false });

schema.index({ mandate: 1, versionNumber: 1 }, { unique: true });
schema.index({ mandate: 1, effectiveFrom: -1 });
appendOnlyPlugin(schema, { errorCode: 'MANDATE_VERSION_IMMUTABLE' });

module.exports = mongoose.model('ManagementMandateVersion', schema);
