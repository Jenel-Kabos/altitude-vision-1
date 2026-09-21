const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema({
  domain: { type: String, enum: ['real_estate'], default: 'real_estate', required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  reservation: { type: ObjectId, ref: 'AccommodationReservation', required: true, index: true },
  accommodation: { type: ObjectId, ref: 'Accommodation', required: true },
  client: { type: ObjectId, ref: 'User', required: true },
  category: { type: String, enum: ['damage', 'cleaning', 'missing_item', 'rule_violation', 'other'], required: true },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  reportedAmountMinor: { type: Number, required: true, min: 1 },
  approvedAmountMinor: { type: Number, min: 0, default: null },
  appliedAmountMinor: { type: Number, min: 0, default: 0 },
  currency: { type: String, enum: ['XAF'], default: 'XAF', required: true },
  status: { type: String, enum: ['pending_validation', 'approved', 'rejected', 'applied'], default: 'pending_validation', index: true },
  evidence: [{ url: { type: String, trim: true }, type: { type: String, enum: ['photo', 'document', 'inspection', 'invoice', 'other'], default: 'other' }, label: { type: String, trim: true, maxlength: 200 } }],
  createdBy: { type: ObjectId, ref: 'User', required: true }, validatedBy: { type: ObjectId, ref: 'User' }, validatedAt: Date,
  rejectedBy: { type: ObjectId, ref: 'User' }, rejectedAt: Date, rejectionReason: { type: String, trim: true, maxlength: 1000 },
  appliedAt: Date, businessOperationKey: { type: String, required: true, maxlength: 200 },
}, { timestamps: true });

['reportedAmountMinor', 'approvedAmountMinor', 'appliedAmountMinor'].forEach((path) => schema.path(path).validate((value) => value == null || Number.isSafeInteger(value), `${path} doit etre un entier sur.`));
schema.index({ tenant: 1, businessOperationKey: 1 }, { unique: true });
module.exports = mongoose.model('FinancialDeduction', schema);
