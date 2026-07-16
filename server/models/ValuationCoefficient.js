const mongoose = require('mongoose');
const { PROPERTY_TYPES, COEFFICIENT_CATEGORIES } = require('../utils/valuationConstants');

const valuationCoefficientSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  label: { type: String, required: true, trim: true }, category: { type: String, enum: COEFFICIENT_CATEGORIES, required: true },
  description: { type: String, default: '' }, minValue: { type: Number, required: true, min: 0.1 }, defaultValue: { type: Number, required: true, min: 0.1 }, maxValue: { type: Number, required: true, min: 0.1 },
  applicablePropertyTypes: [{ type: String, enum: PROPERTY_TYPES }], city: { type: String, default: '' }, district: { type: String, default: '' },
  effectiveFrom: { type: Date, default: Date.now }, effectiveTo: { type: Date, default: null }, version: { type: Number, default: 1, min: 1 },
  active: { type: Boolean, default: true, index: true }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
valuationCoefficientSchema.pre('validate', function validateRange(next) {
  if (this.minValue > this.defaultValue || this.defaultValue > this.maxValue) return next(new Error('Les coefficients doivent respecter min ≤ défaut ≤ max.'));
  if (this.effectiveTo && this.effectiveFrom && this.effectiveTo < this.effectiveFrom) return next(new Error('La date de fin doit être postérieure à la date de début.'));
  next();
});
module.exports = mongoose.model('ValuationCoefficient', valuationCoefficientSchema);
