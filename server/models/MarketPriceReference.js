const mongoose = require('mongoose');
const { PROPERTY_TYPES } = require('../utils/valuationConstants');

const marketPriceReferenceSchema = new mongoose.Schema({
  country: { type: String, default: 'Congo', trim: true },
  city: { type: String, required: true, trim: true, index: true },
  district: { type: String, default: '', trim: true },
  neighborhood: { type: String, default: '', trim: true },
  microZone: { type: String, default: '', trim: true },
  propertyType: { type: String, enum: PROPERTY_TYPES, required: true, index: true },
  transactionType: { type: String, enum: ['vente', 'location'], default: 'vente' },
  priceType: { type: String, enum: ['demande', 'negocie', 'conclu'], default: 'demande', index: true },
  minPricePerSqm: { type: Number, required: true, min: 0 },
  averagePricePerSqm: { type: Number, required: true, min: 0 },
  maxPricePerSqm: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'XAF', enum: ['XAF'] },
  dataSource: { type: String, required: true, trim: true },
  sourceType: { type: String, enum: ['transaction_altimmo', 'annonce_interne', 'expertise_validee', 'partenaire', 'etude_terrain', 'administrative', 'demonstration'], required: true },
  sampleSize: { type: Number, default: 0, min: 0 },
  confidenceLevel: { type: String, enum: ['faible', 'moyen', 'bon', 'élevé'], default: 'faible' },
  validFrom: { type: Date, default: Date.now }, validTo: { type: Date, default: null },
  lastUpdatedAt: { type: Date, default: Date.now }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, default: '' }, active: { type: Boolean, default: true, index: true },
}, { timestamps: true });

marketPriceReferenceSchema.pre('validate', function validateRange(next) {
  if (this.minPricePerSqm > this.averagePricePerSqm || this.averagePricePerSqm > this.maxPricePerSqm) return next(new Error('Les prix doivent respecter min ≤ moyenne ≤ max.'));
  next();
});
marketPriceReferenceSchema.index({ active: 1, city: 1, propertyType: 1, transactionType: 1, validFrom: -1 });
marketPriceReferenceSchema.index({ city: 1, district: 1, neighborhood: 1, priceType: 1, validFrom: -1 });
module.exports = mongoose.model('MarketPriceReference', marketPriceReferenceSchema);
