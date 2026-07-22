const mongoose = require('mongoose');
const { FINANCIAL_DOMAINS, FINANCIAL_DOCUMENT_TYPES, FINANCIAL_ESTABLISHMENT_TYPES } = require('../constants/financialConstants');

const schema = new mongoose.Schema({
  domain: { type: String, enum: FINANCIAL_DOMAINS, required: true },
  establishmentType: { type: String, enum: FINANCIAL_ESTABLISHMENT_TYPES, required: true },
  establishmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  documentType: { type: String, enum: FINANCIAL_DOCUMENT_TYPES, required: true },
  year: { type: Number, required: true },
  prefix: { type: String, required: true, trim: true, maxlength: 30 },
  currentValue: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true });
schema.index({ domain: 1, establishmentType: 1, establishmentId: 1, documentType: 1, year: 1 }, { unique: true });
module.exports = mongoose.model('FinancialSequence', schema);
