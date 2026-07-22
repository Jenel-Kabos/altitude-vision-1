const mongoose = require('mongoose');
const C = require('../constants/financialConstants');
const ObjectId = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema({
  financialDocument: { type: ObjectId, ref: 'FinancialDocument', required: true }, lineNumber: { type: Number, required: true, min: 1 }, lineType: { type: String, enum: C.FINANCIAL_LINE_TYPES, required: true },
  description: { type: String, required: true, trim: true, maxlength: 500 }, quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger }, unitAmountMinor: { type: Number, required: true, min: 0 },
  subtotalMinor: { type: Number, required: true, min: 0 }, discountAmountMinor: { type: Number, default: 0, min: 0 }, taxAmountMinor: { type: Number, default: 0, min: 0 }, feesAmountMinor: { type: Number, default: 0, min: 0 }, totalMinor: { type: Number, required: true, min: 0 },
  taxes: [{ taxCode: String, taxLabel: String, rateBasisPoints: { type: Number, min: 0 }, amountMinor: { type: Number, min: 0 }, included: { type: Boolean, default: false } }],
  sourceType: { type: String, enum: C.FINANCIAL_SUBJECT_TYPES, required: true }, sourceId: { type: ObjectId, required: true }, serviceDate: Date, metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, createdBy: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ financialDocument: 1, lineNumber: 1 }, { unique: true });
schema.index({ sourceType: 1, sourceId: 1 });
module.exports = mongoose.model('FinancialDocumentLine', schema);
