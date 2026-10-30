const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  event: { type: String, enum: ['submitted', 'superseded', 'approved', 'rejected'], required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, trim: true, maxlength: 1000, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  resourceType: { type: String, enum: ['Property', 'Hotel', 'Accommodation'], required: true, index: true },
  resource: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  baseVersion: { type: Number, required: true, min: 0 },
  proposedSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  changedFields: [{ type: String, required: true }],
  submissionType: {
    type: String,
    enum: ['initial', 'content_change', 'reactivation', 'suspension_review'],
    default: 'content_change',
    index: true,
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'superseded'], default: 'pending', index: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  decisionReason: { type: String, trim: true, maxlength: 1000, default: '' },
  history: { type: [historySchema], default: [] },
}, { timestamps: true, optimisticConcurrency: true });

schema.index({ resourceType: 1, resource: 1, createdAt: -1 });
schema.index(
  { resourceType: 1, resource: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

module.exports = mongoose.model('CommercialPublicationRevision', schema);
