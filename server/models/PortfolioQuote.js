// F-U2.9 — Devis d'abonnement fixe de la formule Grand portefeuille (21 biens
// et plus). Préparé par Altitude Vision, accepté de façon traçable par le
// titulaire ; aucun abonnement fixe n'est facturé sans devis accepté.

const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  subscriptionType: { type: String, enum: ['PlatformTenantSubscription', 'IndividualSubscription'], required: true },
  subscriptionId: { type: ObjectId, required: true, index: true },
  holderType: { type: String, enum: ['TENANT', 'USER'], required: true },
  holderId: { type: ObjectId, required: true },
  monthlyPriceMinor: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ['XAF'], default: 'XAF' },
  effectiveFrom: { type: Date, required: true },
  countedPropertiesAtQuote: { type: Number, required: true },
  status: { type: String, enum: ['proposed', 'accepted', 'rejected', 'withdrawn'], default: 'proposed', index: true },
  decisionReference: { type: String, trim: true, maxlength: 300 },
  preparedBy: { type: ObjectId, ref: 'User', required: true },
  decidedBy: { type: ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  decisionMethod: { type: String, enum: ['IN_APP', null], default: null },
  history: [{ _id: false, action: String, actor: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, reason: String }],
}, { timestamps: true });

schema.path('monthlyPriceMinor').validate(Number.isSafeInteger, 'monthlyPriceMinor doit être un entier.');

module.exports = mongoose.model('PortfolioQuote', schema);
