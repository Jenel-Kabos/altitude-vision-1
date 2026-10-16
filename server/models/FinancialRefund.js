const mongoose = require('mongoose');
const C = require('../constants/financialConstants');
const ObjectId = mongoose.Schema.Types.ObjectId;
const { GOVERNED_REFUND_STATUSES, REFUND_ACTIVITIES, REFUND_SIGNALS, REFUND_CLASSIFICATIONS } = require('../constants/contractualFinanceConstants');

const governanceSchema = new mongoose.Schema({
  activity: { type: String, enum: Object.values(REFUND_ACTIVITIES), required: true },
  authorityPlane: { type: String, enum: ['TENANT', 'PLATFORM'], required: true },
  policy: { type: ObjectId, ref: 'FinancialRefundPolicy', default: null },
  policySnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  classification: { type: String, enum: Object.values(REFUND_CLASSIFICATIONS), required: true },
  signals: [{ type: String, enum: Object.values(REFUND_SIGNALS) }],
  requiredApprovals: { type: Number, required: true, min: 1, max: 2 },
  approvers: [{ type: ObjectId, ref: 'User' }],
  approvalCount: { type: Number, default: 0, min: 0 },
  approvalRound: { type: Number, default: 1, min: 1 },
  beneficiary: { sameAsPayer: { type: Boolean, required: true }, beneficiaryId: { type: ObjectId, ref: 'FinancialBeneficiary', default: null } },
  ownerConsent: { isRequired: { type: Boolean, default: false }, owner: { type: ObjectId, ref: 'User', default: null }, mandate: { type: ObjectId, ref: 'ManagementMandate', default: null }, status: { type: String, enum: ['not_required', 'pending', 'given', 'refused'], default: 'not_required' }, decidedBy: { type: ObjectId, ref: 'User', default: null }, representation: { type: ObjectId, ref: 'OwnerRepresentation', default: null }, decidedAt: Date },
  blockedBy: { type: ObjectId, ref: 'User', default: null },
  blockedAt: Date,
  unblockedBy: { type: ObjectId, ref: 'User', default: null },
  unblockedAt: Date,
  releasedForExecutionBy: { type: ObjectId, ref: 'User', default: null },
  releasedForExecutionAt: Date,
  executionEnabled: { type: Boolean, default: false },
  refusedBy: { type: ObjectId, ref: 'User', default: null },
  refusedAt: Date,
}, { _id: false });

const schema = new mongoose.Schema({
  domain: { type: String, enum: C.FINANCIAL_DOMAINS, required: true },
  establishmentType: { type: String, enum: C.FINANCIAL_ESTABLISHMENT_TYPES, required: true }, establishmentId: { type: ObjectId, required: true },
  financialPayment: { type: ObjectId, ref: 'FinancialPayment', required: true, index: true }, financialDocument: { type: ObjectId, ref: 'FinancialDocument', required: true },
  subjectType: { type: String, enum: C.FINANCIAL_SUBJECT_TYPES, required: true }, subjectId: { type: ObjectId, required: true, index: true },
  amountMinor: { type: Number, required: true, min: 1 }, currency: { type: String, enum: C.FINANCIAL_CURRENCIES, required: true },
  method: { type: String, enum: ['cash', 'bank_transfer', 'cheque'] }, status: { type: String, enum: ['requested', 'approved', 'processing', 'completed', 'failed', 'cancelled', ...GOVERNED_REFUND_STATUSES], default: 'requested', index: true },
  reasonCode: { type: String, enum: ['CLIENT_CANCELLATION', 'OWNER_CANCELLATION', 'PLATFORM_CANCELLATION', 'LATE_PAYMENT_AFTER_EXPIRY', 'OVERPAYMENT', 'SERVICE_NOT_RENDERED', 'DUPLICATE_PAYMENT', 'OTHER'], index: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 }, provider: { type: String, default: 'manual' }, providerRefundSupported: { type: Boolean, default: false }, manualReference: { type: String, trim: true }, proofUrl: { type: String, trim: true }, comment: { type: String, trim: true, maxlength: 2000 },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true }, requestedBy: { type: ObjectId, ref: 'User' }, approvedBy: { type: ObjectId, ref: 'User' }, processedBy: { type: ObjectId, ref: 'User' }, cancelledBy: { type: ObjectId, ref: 'User' },
  requestedAt: { type: Date, default: Date.now }, approvedAt: Date, processedAt: Date, failedAt: Date, cancelledAt: Date, failureReason: String,
  businessOperationKey: { type: String, required: true, maxlength: 200 }, metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  // F-U1.E — gouvernance (absente sur les remboursements historiques, qui
  // conservent leur cycle requested → approved → processing → completed).
  governance: { type: governanceSchema, default: undefined },
}, { timestamps: true });
schema.path('amountMinor').validate(Number.isSafeInteger, 'amountMinor doit être un entier sûr.');
schema.index({ domain: 1, establishmentId: 1, businessOperationKey: 1 }, { unique: true });
schema.index({ financialPayment: 1, status: 1 });
schema.index({ manualReference: 1 }, { unique: true, partialFilterExpression: { manualReference: { $type: 'string' } } });
module.exports = mongoose.model('FinancialRefund', schema);
