// F-U2.9 — Frais variables de 1 % de la gestion autonome, rattachés à
// l'encaissement confirmé qui les génère.
//
// Une ligne par allocation (PaymentAllocation active d'un FinancialPayment
// confirmé sur une facture de loyer) et par nature : l'index unique
// {allocation, kind} interdit durablement toute double facturation, même en
// cas d'appels simultanés. Les contrepassations sont des lignes distinctes
// (kind REVERSAL) : l'historique n'est jamais effacé.

const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  allocation: { type: ObjectId, ref: 'PaymentAllocation', required: true },
  kind: { type: String, enum: ['FEE', 'REVERSAL'], required: true },
  holderType: { type: String, enum: ['TENANT', 'USER'], required: true },
  holderId: { type: ObjectId, required: true },
  subscriptionType: { type: String, enum: ['PlatformTenantSubscription', 'IndividualSubscription'], required: true },
  subscriptionId: { type: ObjectId, required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null },
  property: { type: ObjectId, ref: 'Property', required: true },
  lease: { type: ObjectId, ref: 'Contrat', default: null },
  payment: { type: ObjectId, ref: 'FinancialPayment', required: true },
  rentDocument: { type: ObjectId, ref: 'FinancialDocument', required: true },
  allocatedMinor: { type: Number, required: true },
  baseMinor: { type: Number, required: true },
  rateBasisPoints: { type: Number, required: true },
  feeMinor: { type: Number, required: true },
  policyVersion: { type: String, required: true },
  confirmedAt: { type: Date, required: true },
  period: { type: String, required: true },
  status: { type: String, enum: ['accrued', 'invoiced', 'cancelled', 'reversal_pending_decision'], required: true, index: true },
  financialDocument: { type: ObjectId, ref: 'FinancialDocument', default: null },
  reason: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

['allocatedMinor', 'baseMinor', 'feeMinor'].forEach((path) => schema.path(path).validate(Number.isSafeInteger, `${path} doit être un entier.`));
schema.index({ allocation: 1, kind: 1 }, { unique: true });
schema.index({ subscriptionType: 1, subscriptionId: 1, period: 1, status: 1 });

module.exports = mongoose.model('AutonomousVariableFeeAccrual', schema);
