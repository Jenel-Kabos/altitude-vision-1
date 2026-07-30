const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  provider: { type: String, required: true },
  providerEventId: { type: String, required: true },
  providerPaymentId: String,
  providerTransactionId: String,
  eventType: { type: String, required: true },
  payloadHash: { type: String, required: true },
  payloadSnapshot: { type: mongoose.Schema.Types.Mixed, select: false },
  signatureVerified: { type: Boolean, required: true },
  receivedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['received', 'processing', 'processed', 'failed'], default: 'received' },
  processingStartedAt: Date,
  processedAt: Date,
  failedAt: Date,
  processingDuration: Number,
  attemptCount: { type: Number, default: 0 },
  retryCount: { type: Number, default: 0 },
  result: { type: mongoose.Schema.Types.Mixed, default: {} },
  error: { type: mongoose.Schema.Types.Mixed, select: false },
  lastError: { type: String, select: false },
  financialPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialPayment' },
  businessOperationKey: { type: String, required: true },
}, { timestamps: true });
schema.index({ provider: 1, providerEventId: 1 }, { unique: true }); schema.index({ financialPayment: 1 });
schema.index({ provider: 1, providerTransactionId: 1, receivedAt: -1 });
module.exports = mongoose.model('FinancialProviderEvent', schema);
