const mongoose = require('mongoose');

const STAGES = ['prospect', 'qualification', 'proposition', 'negociation', 'contrat', 'client_actif', 'fidelisation', 'ancien_client'];
const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmCustomer', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  pole: { type: String, enum: ['Altimmo', 'Accommodation', 'Hotel', 'Altcom', 'MilaEvents', 'Transversal'], default: 'Transversal' },
  stage: { type: String, enum: STAGES, default: 'prospect', index: true },
  outcome: { type: String, enum: ['open', 'won', 'lost'], default: 'open', index: true },
  outcomeReason: { type: String, trim: true, maxlength: 1000, default: '' },
  valueMinor: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: 'XAF', maxlength: 3 },
  probability: { type: Number, min: 0, max: 100, default: 0 },
  expectedCloseAt: { type: Date, default: null },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sourceRef: { entityType: String, entityId: mongoose.Schema.Types.ObjectId },
  history: [{ from: String, to: { type: String, enum: STAGES }, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, note: String }],
  closedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ stage: 1, updatedAt: -1 });
schema.index({ outcome: 1, closedAt: -1 });
module.exports = mongoose.model('CrmOpportunity', schema);
module.exports.STAGES = STAGES;
