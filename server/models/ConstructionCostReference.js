const mongoose = require('mongoose');
const { CONSTRUCTION_CATEGORIES } = require('../utils/valuationConstants');
const constructionCostReferenceSchema = new mongoose.Schema({
  city: { type: String, required: true, trim: true, index: true }, constructionCategory: { type: String, enum: CONSTRUCTION_CATEGORIES, required: true },
  buildingUse: { type: String, default: '' }, costMinPerSqm: { type: Number, required: true, min: 0 },
  costAveragePerSqm: { type: Number, required: true, min: 0 }, costMaxPerSqm: { type: Number, required: true, min: 0 },
  materialsLevel: { type: String, default: '' }, year: { type: Number, min: 1900, max: 2200 },
  source: { type: String, required: true }, confidenceLevel: { type: String, enum: ['faible', 'moyen', 'bon', 'élevé'], default: 'faible' }, active: { type: Boolean, default: true },
}, { timestamps: true });
constructionCostReferenceSchema.pre('validate', function validateRange(next) {
  if (this.costMinPerSqm > this.costAveragePerSqm || this.costAveragePerSqm > this.costMaxPerSqm) return next(new Error('Les coûts doivent respecter min ≤ moyenne ≤ max.'));
  next();
});
module.exports = mongoose.model('ConstructionCostReference', constructionCostReferenceSchema);
