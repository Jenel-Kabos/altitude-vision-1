// F-U2.9 — Historique des classements de portefeuille (formule applicable,
// décomptes par catégorie, politique de comptage). Une entrée nouvelle à
// chaque changement constaté ; jamais modifiée.

const mongoose = require('mongoose');
const appendOnlyPlugin = require('./schemas/appendOnlyPlugin');

const schema = new mongoose.Schema({
  holderType: { type: String, enum: ['TENANT', 'USER'], required: true },
  holderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  at: { type: Date, required: true },
  counts: { type: mongoose.Schema.Types.Mixed, required: true },
  formula: { type: String, default: null },
  ambiguous: { type: Boolean, required: true },
  fingerprint: { type: String, required: true },
  pricingVersion: { type: String, required: true },
  countingPolicyStatus: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

schema.index({ holderType: 1, holderId: 1, at: -1 });
appendOnlyPlugin(schema, { errorCode: 'PORTFOLIO_CLASSIFICATION_IMMUTABLE' });

module.exports = mongoose.model('PortfolioClassificationSnapshot', schema);
