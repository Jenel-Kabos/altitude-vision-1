const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  action: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, trim: true, maxlength: 2000 },
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contrat', required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'resolved', 'anomaly', 'reverted'], default: 'pending', index: true },
  decision: { type: String, enum: ['link_existing', 'create_internal', 'close_historical', 'flag_anomaly', null], default: null },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  createdProperty: { type: Boolean, default: false },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  events: { type: [eventSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('RentalContractReconciliation', schema);
