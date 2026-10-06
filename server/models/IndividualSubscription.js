const mongoose = require('mongoose');
const {
  PLATFORM_TENANT_PLANS,
  PLATFORM_TENANT_SUBSCRIPTION_STATUSES,
  TENANT_FEATURE_MODULES,
} = require('../constants/platformTenantConstants');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: PLATFORM_TENANT_PLANS, required: true },
  status: {
    type: String,
    enum: PLATFORM_TENANT_SUBSCRIPTION_STATUSES,
    default: 'trialing',
    index: true,
  },
  modulesIncluded: { type: [String], enum: TENANT_FEATURE_MODULES, default: [] },
  quotas: {
    maxManagedProperties: { type: Number, default: null, min: 0 },
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null },
  cancellationReason: { type: String, maxlength: 1000, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

schema.index({ user: 1, status: 1 });
schema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['trialing', 'active'] } } },
);

module.exports = mongoose.model('IndividualSubscription', schema);
