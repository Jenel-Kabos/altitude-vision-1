const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema({
  financialDocument: { type: ObjectId, ref: 'FinancialDocument', required: true },
  establishmentId: { type: ObjectId, required: true },
  reservationId: { type: ObjectId, ref: 'HotelReservation', default: null },
  artifact: { type: ObjectId, ref: 'FinancialDocumentArtifact', required: true },
  artifactHash: { type: String, required: true },
  artifactTemplateVersion: { type: String, required: true },
  channel: { type: String, enum: ['email'], default: 'email' },
  recipient: { type: String, required: true },
  cc: { type: [String], default: [] },
  subject: { type: String, required: true, maxlength: 300 },
  provider: { type: String, default: 'zoho-smtp' },
  providerMessageId: { type: String, default: null },
  status: { type: String, enum: ['pending', 'sent', 'failed', 'delivery_unknown', 'cancelled'], default: 'pending' },
  attemptNumber: { type: Number, required: true, min: 1 },
  idempotencyKeyHash: { type: String, required: true, select: false },
  payloadHash: { type: String, required: true, select: false },
  requestedBy: { type: ObjectId, ref: 'User', required: true },
  requestedAt: { type: Date, default: Date.now },
  sentAt: Date,
  failedAt: Date,
  normalizedErrorCode: String,
  normalizedErrorMessage: { type: String, maxlength: 500 },
  correlationId: { type: String, required: true },
}, { timestamps: true });

schema.index({ idempotencyKeyHash: 1 }, { unique: true });
schema.index({ financialDocument: 1, requestedAt: -1 });
schema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function preventDeliveryDeletion() { throw new Error('FINANCIAL_DELIVERY_APPEND_ONLY'); });
schema.pre('save', function preventTerminalMutation() {
  if (!this.isNew && this.isModified('status') && ['sent', 'failed', 'delivery_unknown', 'cancelled'].includes(this.$locals.previousStatus)) throw new Error('FINANCIAL_DELIVERY_APPEND_ONLY');
});
schema.post('init', function rememberStatus(doc) { doc.$locals.previousStatus = doc.status; });

module.exports = mongoose.model('FinancialDocumentDelivery', schema);
