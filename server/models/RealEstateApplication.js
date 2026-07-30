const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  from: String,
  to: String,
  action: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, trim: true, maxlength: 1000, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: false });

const attachmentSchema = new mongoose.Schema({
  storageKey: { type: String, required: true, select: false },
  name: { type: String, required: true, trim: true, maxlength: 180 },
  mimeType: { type: String, required: true, enum: ['application/pdf', 'image/jpeg', 'image/png'] },
  size: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const applicationSchema = new mongoose.Schema({
  kind: { type: String, enum: ['purchase_offer', 'rental_application'], required: true, index: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visite', default: null },
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'accepted', 'rejected', 'withdrawn', 'expired', 'not_selected'],
    default: 'submitted',
    index: true,
  },
  validUntil: { type: Date, required: true, index: true },
  message: { type: String, trim: true, maxlength: 3000, default: '' },
  purchaseOffer: {
    amount: { type: Number, min: 1 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: 'XAF' },
    conditions: { type: String, trim: true, maxlength: 3000, default: '' },
  },
  rentalApplication: {
    desiredMoveIn: Date,
    desiredDurationMonths: { type: Number, min: 1, max: 120 },
    occupants: { type: Number, min: 1, max: 20 },
    monthlyIncome: { type: Number, min: 0, select: false },
    incomeCurrency: { type: String, trim: true, uppercase: true, maxlength: 3, default: 'XAF', select: false },
  },
  attachments: { type: [attachmentSchema], default: [], select: false },
  decisionReason: { type: String, trim: true, maxlength: 1000, default: '' },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: Date,
  reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'RealEstateReservation', default: null },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

applicationSchema.index({ property: 1, status: 1, createdAt: -1 });
applicationSchema.index({ applicant: 1, createdAt: -1 });
applicationSchema.index({ owner: 1, kind: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('RealEstateApplication', applicationSchema);
