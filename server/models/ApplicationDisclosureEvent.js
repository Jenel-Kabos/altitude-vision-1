const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'RealEstateApplication', required: true, index: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  category: { type: String, enum: ['contact_details', 'evidence_metadata', 'evidence_download'], required: true },
  fields: [{ type: String, trim: true, maxlength: 80 }],
  reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  authorityMode: { type: String, enum: ['platform_mediator', 'authorized_contact', 'applicant_self'], required: true },
  contactAuthorization: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactAuthorization', default: null },
}, { timestamps: true });

schema.index({ application: 1, createdAt: -1 });
module.exports = mongoose.model('ApplicationDisclosureEvent', schema);
