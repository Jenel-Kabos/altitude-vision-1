const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  customerA: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmCustomer', required: true, index: true },
  customerB: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmCustomer', required: true, index: true },
  keptCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmCustomer', default: null },
  archivedCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmCustomer', default: null },
  decision: { type: String, enum: ['keep_a', 'keep_b', 'defer'], required: true },
  justification: { type: String, required: true, trim: true, minlength: 5, maxlength: 2000 },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  decidedAt: { type: Date, default: Date.now, immutable: true },
  before: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  after: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  duplicateAssessment: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
}, { timestamps: true });
schema.index({ customerA: 1, customerB: 1, decidedAt: -1 });
schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function blockMutation(next) {
  next(new Error('Le journal de consolidation CRM est append-only.'));
});
module.exports = mongoose.model('CrmConsolidation', schema);
