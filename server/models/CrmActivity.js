const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmCustomer', required: true, index: true },
  opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmOpportunity', default: null },
  type: { type: String, enum: ['rendez_vous', 'tache', 'rappel', 'relance', 'note', 'appel', 'email', 'sms', 'whatsapp'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  content: { type: String, trim: true, maxlength: 5000, default: '' },
  dueAt: { type: Date, default: null, index: true },
  status: { type: String, enum: ['a_faire', 'en_cours', 'terminee', 'annulee'], default: 'a_faire', index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: { type: Date, default: null },
  history: [{ action: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, metadata: mongoose.Schema.Types.Mixed }],
}, { timestamps: true });
schema.index({ assignedTo: 1, status: 1, dueAt: 1 });
module.exports = mongoose.model('CrmActivity', schema);
