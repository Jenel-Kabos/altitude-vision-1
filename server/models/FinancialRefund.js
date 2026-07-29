const mongoose = require('mongoose');
const C = require('../constants/financialConstants');
const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  domain: { type: String, enum: C.FINANCIAL_DOMAINS, required: true },
  establishmentType: { type: String, enum: C.FINANCIAL_ESTABLISHMENT_TYPES, required: true }, establishmentId: { type: ObjectId, required: true },
  financialPayment: { type: ObjectId, ref: 'FinancialPayment', required: true, index: true }, financialDocument: { type: ObjectId, ref: 'FinancialDocument', required: true },
  subjectType: { type: String, enum: C.FINANCIAL_SUBJECT_TYPES, required: true }, subjectId: { type: ObjectId, required: true, index: true },
  amountMinor: { type: Number, required: true, min: 1 }, currency: { type: String, enum: C.FINANCIAL_CURRENCIES, required: true },
  method: { type: String, enum: ['cash', 'bank_transfer', 'cheque'], required: true }, status: { type: String, enum: ['requested', 'approved', 'processing', 'completed', 'failed', 'cancelled'], default: 'requested', index: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 }, manualReference: { type: String, trim: true }, proofUrl: { type: String, trim: true }, comment: { type: String, trim: true, maxlength: 2000 },
  requestedBy: { type: ObjectId, ref: 'User', required: true }, approvedBy: { type: ObjectId, ref: 'User' }, processedBy: { type: ObjectId, ref: 'User' }, cancelledBy: { type: ObjectId, ref: 'User' },
  requestedAt: { type: Date, default: Date.now }, approvedAt: Date, processedAt: Date, failedAt: Date, cancelledAt: Date, failureReason: String,
  businessOperationKey: { type: String, required: true, maxlength: 200 }, metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
schema.path('amountMinor').validate(Number.isSafeInteger, 'amountMinor doit être un entier sûr.');
schema.index({ domain: 1, establishmentId: 1, businessOperationKey: 1 }, { unique: true });
schema.index({ financialPayment: 1, status: 1 });
module.exports = mongoose.model('FinancialRefund', schema);
