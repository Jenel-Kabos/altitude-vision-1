// F-U1.D — Obligation financière entre le mandataire et le propriétaire, par
// mandat et par période contractuelle de reversement.
//
//   - OWNER_PAYOUT : fonds détenus pour le propriétaire (encaissement agence),
//     nets de la commission, des frais à sa charge et des dépenses justifiées.
//   - COMMISSION_RECEIVABLE : commission due par le propriétaire lorsque le
//     loyer lui a été payé directement (OWNER_DIRECT), plus les dépenses
//     justifiées récupérables.
//
// Chaque ligne a une clé unique : l'accumulation est idempotente. Aucune
// exécution sortante n'est activée (executionStatus figé à NOT_ENABLED).

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');
const { FINANCIAL_CURRENCIES } = require('../constants/financialConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const lineSchema = new mongoose.Schema({
  key: { type: String, required: true, maxlength: 300 },
  kind: { type: String, enum: Object.values(C.OBLIGATION_LINE_KINDS), required: true },
  sourceType: { type: String, enum: ['MandateCollection', 'MandateExpense'], required: true },
  sourceId: { type: ObjectId, required: true },
  amountMinor: { type: Number, required: true },
  at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  mandataryType: { type: String, enum: Object.values(C.MANDATARY_TYPES), required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  mandate: { type: ObjectId, ref: 'ManagementMandate', required: true },
  owner: { type: ObjectId, ref: 'User', required: true, index: true },
  property: { type: ObjectId, ref: 'Property', required: true },
  type: { type: String, enum: Object.values(C.OBLIGATION_TYPES), required: true },
  periodKey: { type: String, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  payoutFrequency: { type: String, enum: [...Object.values(C.PAYOUT_FREQUENCIES), null], default: null },
  currency: { type: String, enum: FINANCIAL_CURRENCIES, required: true },
  beneficiary: { type: ObjectId, ref: 'FinancialBeneficiary', default: null },
  lines: { type: [lineSchema], default: [] },
  netAmountMinor: { type: Number, default: 0 },
  executionStatus: { type: String, enum: [C.OBLIGATION_EXECUTION_STATUS], default: C.OBLIGATION_EXECUTION_STATUS },
}, { timestamps: true });

schema.path('netAmountMinor').validate(Number.isSafeInteger, 'netAmountMinor doit être un entier sûr.');
schema.index({ mandate: 1, type: 1, periodKey: 1 }, { unique: true });

module.exports = mongoose.model('OwnerFinancialObligation', schema);
