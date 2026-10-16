// F-U1.E — Politique de remboursement par activité et par périmètre.
//
// Les seuils chiffrés ne sont pas encore validés : une politique peut exister
// à l'état `unconfigured` (aucun seuil), auquel cas tout remboursement exige
// la double validation (signal POLICY_UNCONFIGURED). Le passage à `active`
// exige un seuil explicite et un activateur distinct du rédacteur.

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');
const { FINANCIAL_CURRENCIES } = require('../constants/financialConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  scopeType: { type: String, enum: Object.values(C.MANDATARY_TYPES), required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  activity: { type: String, enum: Object.values(C.REFUND_ACTIVITIES), required: true },
  version: { type: Number, required: true, min: 1 },
  status: { type: String, enum: Object.values(C.REFUND_POLICY_STATUSES), required: true },
  currency: { type: String, enum: FINANCIAL_CURRENCIES, required: true },
  standardApprovalMaxMinor: { type: Number, default: null, min: 1 },
  additionalDualApprovalSignals: [{ type: String, enum: Object.values(C.REFUND_SIGNALS) }],
  ownerConsentRequired: { type: Boolean, required: true },
  decisionReference: { type: String, trim: true, maxlength: 300 },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  activatedBy: { type: ObjectId, ref: 'User', default: null },
  activatedAt: { type: Date, default: null },
  retiredBy: { type: ObjectId, ref: 'User', default: null },
  retiredAt: { type: Date, default: null },
}, { timestamps: true });

schema.path('standardApprovalMaxMinor').validate((value) => value == null || Number.isSafeInteger(value), 'standardApprovalMaxMinor doit être un entier sûr.');
schema.path('tenant').validate(function tenantMatchesScope(value) {
  return this.scopeType === C.MANDATARY_TYPES.TENANT ? Boolean(value) : value == null;
}, 'tenant est requis pour une politique TENANT et interdit pour une politique PLATFORM.');
schema.index({ scopeType: 1, tenant: 1, activity: 1, version: 1 }, { unique: true });
schema.index(
  { scopeType: 1, tenant: 1, activity: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

module.exports = mongoose.model('FinancialRefundPolicy', schema);
