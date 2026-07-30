const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'RealEstateApplication', required: true, unique: true },
  type: { type: String, enum: ['sale', 'rental'], required: true },
  status: { type: String, enum: ['active', 'converted', 'cancelled', 'expired'], default: 'active', index: true },
  expiresAt: { type: Date, required: true, index: true },
  cancellationReason: { type: String, trim: true, maxlength: 1000, default: '' },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contrat', default: null },
  idempotencyKey: { type: String, required: true, unique: true, maxlength: 200 },
  expirationReminderSentAt: { type: Date, default: null },
  history: [{
    from: String, to: String, action: String,
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, trim: true, maxlength: 1000, default: '' },
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

reservationSchema.index({ status: 1, expiresAt: 1 });
reservationSchema.index(
  { property: 1 },
  { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_active_real_estate_reservation_per_property' },
);

module.exports = mongoose.model('RealEstateReservation', reservationSchema);
