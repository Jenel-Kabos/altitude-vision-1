const mongoose = require('mongoose');
const C = require('../constants/financialConstants');
const ObjectId = mongoose.Schema.Types.ObjectId;
const snapshot = { name: String, email: String, phone: String, address: String, taxIdentifier: String, userId: { type: ObjectId, ref: 'User', default: null }, legalInformation: String };
const schema = new mongoose.Schema({
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  domain: { type: String, enum: C.FINANCIAL_DOMAINS, required: true }, establishmentType: { type: String, enum: C.FINANCIAL_ESTABLISHMENT_TYPES, required: true }, establishmentId: { type: ObjectId, required: true },
  documentType: { type: String, enum: C.FINANCIAL_DOCUMENT_TYPES, required: true, default: 'invoice' }, documentNumber: { type: String, default: null }, sequenceValue: { type: Number, default: null }, sequenceYear: { type: Number, default: null },
  status: { type: String, enum: C.FINANCIAL_DOCUMENT_STATUSES, default: 'draft' }, paymentStatus: { type: String, enum: C.FINANCIAL_PAYMENT_STATUSES_DERIVED, default: 'unpaid' }, currency: { type: String, enum: C.FINANCIAL_CURRENCIES, required: true },
  subjectType: { type: String, enum: C.FINANCIAL_SUBJECT_TYPES, required: true }, subjectId: { type: ObjectId, required: true },
  customer: snapshot, seller: snapshot,
  issueDate: Date, dueDate: Date, servicePeriodStart: Date, servicePeriodEnd: Date,
  subtotalMinor: { type: Number, default: 0 }, discountTotalMinor: { type: Number, default: 0 }, taxTotalMinor: { type: Number, default: 0 }, feesTotalMinor: { type: Number, default: 0 }, totalMinor: { type: Number, default: 0 }, amountAllocatedMinor: { type: Number, default: 0 }, refundedAmountMinor: { type: Number, default: 0 }, balanceMinor: { type: Number, default: 0 },
  notes: { type: String, trim: true, maxlength: 2000 }, metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, businessOperationKey: { type: String, required: true, maxlength: 200 },
  issuedAt: Date, issuedBy: { type: ObjectId, ref: 'User' }, cancelledAt: Date, cancelledBy: { type: ObjectId, ref: 'User' }, cancellationReason: String,
  guestAccess: { tokenHash: { type: String, select: false }, expiresAt: Date, revokedAt: Date, scope: [{ type: String, enum: ['view', 'download', 'pay'] }], createdAt: Date, lastAccessAt: Date },
  createdBy: { type: ObjectId, ref: 'User', required: true }, updatedBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true });
['subtotalMinor', 'discountTotalMinor', 'taxTotalMinor', 'feesTotalMinor', 'totalMinor', 'amountAllocatedMinor', 'refundedAmountMinor', 'balanceMinor'].forEach((path) => {
  schema.path(path).validate(Number.isSafeInteger, `${path} doit être un entier sûr.`);
  schema.path(path).validate((value) => value >= 0, `${path} ne peut pas être négatif.`);
});
schema.index({ domain: 1, establishmentId: 1, status: 1 });
schema.index({ domain: 1, establishmentId: 1, documentNumber: 1 }, { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } });
schema.index({ domain: 1, subjectType: 1, subjectId: 1 });
schema.index({ documentType: 1, sequenceYear: 1 });
schema.index({ domain: 1, businessOperationKey: 1 }, { unique: true });
module.exports = mongoose.model('FinancialDocument', schema);
