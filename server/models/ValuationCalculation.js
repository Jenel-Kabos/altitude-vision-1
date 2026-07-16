const mongoose = require('mongoose');
const valuationCalculationSchema = new mongoose.Schema({
  estimationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estimation', required: true, index: true }, version: { type: Number, required: true },
  inputSnapshot: { type: mongoose.Schema.Types.Mixed, required: true }, marketReferenceSnapshot: { type: mongoose.Schema.Types.Mixed, default: [] },
  coefficientsSnapshot: { type: mongoose.Schema.Types.Mixed, default: [] }, methodsResults: { type: mongoose.Schema.Types.Mixed, default: [] },
  finalResult: { type: mongoose.Schema.Types.Mixed, required: true }, confidenceScore: { type: Number, min: 0, max: 100, required: true },
  calculatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, calculatedAt: { type: Date, default: Date.now },
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, validatedAt: { type: Date, default: null },
  reasonForAdjustment: { type: String, default: '' }, engineVersion: { type: String, default: '1.0.0' },
}, { timestamps: true });
valuationCalculationSchema.index({ estimationId: 1, version: -1 }, { unique: true });
module.exports = mongoose.model('ValuationCalculation', valuationCalculationSchema);
