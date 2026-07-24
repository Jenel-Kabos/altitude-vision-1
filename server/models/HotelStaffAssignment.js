const mongoose = require('mongoose');
const { HOTEL_ASSIGNMENT_ROLES, HOTEL_ASSIGNMENT_STATUSES, ALL_HOTEL_CAPABILITY_VALUES } = require('../constants/hotelAccessConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema({
  user: { type: ObjectId, ref: 'User', required: true },
  hotel: { type: ObjectId, ref: 'Hotel', required: true },
  assignmentRole: { type: String, enum: HOTEL_ASSIGNMENT_ROLES, required: true },
  capabilities: { type: [String], default: [], validate: (value) => value.every((cap) => ALL_HOTEL_CAPABILITY_VALUES.includes(cap)) },
  status: { type: String, enum: HOTEL_ASSIGNMENT_STATUSES, default: 'active' },
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date, default: null },
  assignedBy: { type: ObjectId, ref: 'User', required: true },
  assignedAt: { type: Date, default: Date.now },
  suspendedBy: { type: ObjectId, ref: 'User', default: null },
  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String, maxlength: 1000, default: null },
  revokedBy: { type: ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  revocationReason: { type: String, maxlength: 1000, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.path('validUntil').validate(function validPeriod(value) {
  if (!value) return true;
  return value.getTime() > this.validFrom.getTime();
}, 'validUntil doit être postérieur à validFrom.');

schema.index({ user: 1, hotel: 1, status: 1 });
schema.index({ hotel: 1, status: 1, assignmentRole: 1 });
schema.index({ user: 1, status: 1 });
schema.index({ validUntil: 1, status: 1 });
// Un seul rattachement actif par (user, hotel, assignmentRole) — égalité simple sur `status`
// dans le partialFilterExpression pour rester dans les opérateurs supportés par MongoDB
// (les opérateurs comme $ne ne sont pas fiables dans un partialFilterExpression).
schema.index(
  { user: 1, hotel: 1, assignmentRole: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

module.exports = mongoose.model('HotelStaffAssignment', schema);
