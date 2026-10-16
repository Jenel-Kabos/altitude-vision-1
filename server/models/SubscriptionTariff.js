// F-U2.3 — Tarif mensuel d'une formule de gestion autonome.
//
// Aucun prix n'est présumé : un tarif est saisi avec la référence de la
// décision commerciale qui le fixe, puis activé par une personne distincte.
// Versionné par date d'effet ; une facture recopie le tarif appliqué.

const mongoose = require('mongoose');
const { PLATFORM_TENANT_PLANS } = require('../constants/platformTenantConstants');
const { AUTONOMOUS_FORMULAS } = require('../constants/billingConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  // Tarif d'une formule d'abonnement historique (`plan`) OU d'une formule de
  // gestion autonome Altimmo (`formula`, F-U2.9) — exactement l'un des deux.
  plan: { type: String, enum: [...PLATFORM_TENANT_PLANS, null], default: null },
  formula: { type: String, enum: [...AUTONOMOUS_FORMULAS, null], default: null },
  version: { type: Number, required: true, min: 1 },
  currency: { type: String, enum: ['XAF'], required: true },
  // 0 autorisé (formule Gratuit) ; null = sur devis (Grand portefeuille).
  monthlyPriceMinor: { type: Number, default: null, min: 0 },
  // Frais variables en points de base (100 = 1 %) — formules autonomes.
  variableRateBasisPoints: { type: Number, default: null, min: 0, max: 10000 },
  policyVersion: { type: String, default: null },
  // Délai de paiement (jours après le début de la période) ; null = non défini.
  paymentTermDays: { type: Number, default: null, min: 0, max: 365 },
  effectiveFrom: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'active', 'retired'], default: 'draft', index: true },
  decisionReference: { type: String, required: true, trim: true, maxlength: 300 },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  activatedBy: { type: ObjectId, ref: 'User', default: null },
  activatedAt: { type: Date, default: null },
}, { timestamps: true });

['monthlyPriceMinor', 'paymentTermDays', 'variableRateBasisPoints'].forEach((path) => schema.path(path).validate((value) => value == null || Number.isSafeInteger(value), `${path} doit être un entier.`));
schema.path('formula').validate(function exactlyOne(value) { return Boolean(value) !== Boolean(this.plan); }, 'Un tarif porte soit une formule historique, soit une formule autonome.');
schema.path('monthlyPriceMinor').validate(function priceRequired(value) { return this.formula ? true : Number.isSafeInteger(value) && value >= 1; }, 'Prix mensuel requis pour une formule historique.');
schema.index({ plan: 1, formula: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('SubscriptionTariff', schema);
