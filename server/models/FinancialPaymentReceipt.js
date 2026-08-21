const mongoose = require('mongoose');
const C = require('../constants/financialConstants');
const privateAssetSchema = require('./schemas/privateAssetSchema');
const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  financialPayment: { type: ObjectId, ref: 'FinancialPayment', required: true, unique: true, immutable: true },
  domain: { type: String, enum: C.FINANCIAL_DOMAINS, required: true, immutable: true },
  establishmentType: { type: String, enum: C.FINANCIAL_ESTABLISHMENT_TYPES, required: true, immutable: true },
  establishmentId: { type: ObjectId, required: true, immutable: true, index: true },
  receiptNumber: { type: String, required: true, unique: true, immutable: true },
  currency: { type: String, enum: C.FINANCIAL_CURRENCIES, required: true, immutable: true },
  amountMinor: { type: Number, required: true, min: 1, immutable: true },
  method: { type: String, enum: C.FINANCIAL_PAYMENT_METHODS, required: true, immutable: true },
  paymentReference: { type: String, required: true, immutable: true },
  allocations: [{ financialDocument: ObjectId, documentNumber: String, amountMinor: Number }],
  asset: { type: privateAssetSchema, required: true, select: false, immutable: true },
  hash: { type: String, required: true, immutable: true },
  generatedAt: { type: Date, required: true, immutable: true },
  generatedBy: { type: ObjectId, ref: 'User', required: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.path('amountMinor').validate(Number.isSafeInteger, 'amountMinor doit être un entier sûr.');
schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function immutableReceipt() { throw new Error('FINANCIAL_PAYMENT_RECEIPT_IMMUTABLE'); });
schema.pre('save', function immutablePersistedReceipt() { if (!this.isNew) throw new Error('FINANCIAL_PAYMENT_RECEIPT_IMMUTABLE'); });
module.exports = mongoose.model('FinancialPaymentReceipt', schema);
