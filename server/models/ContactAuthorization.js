const mongoose = require('mongoose');

const CONTACT_AUTHORIZATION_STATUSES = Object.freeze(['active', 'revoked']);
const CONTACT_AUTHORIZATION_SCOPES = Object.freeze([
  'direct_transactional_messaging',
  'contact_details_disclosure',
]);
const CONTACT_AUTHORIZATION_DOSSIER_TYPES = Object.freeze([
  'RealEstateApplication',
  'Visite',
  'HotelReservation',
  'AccommodationReservation',
  'Other',
]);

const eventSchema = new mongoose.Schema({
  type: { type: String, enum: ['granted', 'revoked'], required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, default: Date.now, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  scopes: [{ type: String, enum: CONTACT_AUTHORIZATION_SCOPES }],
}, { _id: false });

const schema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  representative: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null, index: true },
  dossierType: { type: String, enum: CONTACT_AUTHORIZATION_DOSSIER_TYPES, default: null },
  dossier: { type: mongoose.Schema.Types.ObjectId, default: null },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  grantedAt: { type: Date, default: Date.now, required: true },
  grantReason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: CONTACT_AUTHORIZATION_STATUSES, default: 'active', index: true },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  revokeReason: { type: String, trim: true, maxlength: 1000, default: null },
  scopes: [{ type: String, enum: CONTACT_AUTHORIZATION_SCOPES, required: true }],
  events: { type: [eventSchema], default: [] },
}, { timestamps: true });

schema.index(
  { client: 1, representative: 1, property: 1, dossierType: 1, dossier: 1, tenant: 1 },
  { unique: true, name: 'contact_authorization_exact_context' },
);
schema.index({ status: 1, scopes: 1, tenant: 1 });

module.exports = mongoose.model('ContactAuthorization', schema);
module.exports.CONTACT_AUTHORIZATION_STATUSES = CONTACT_AUTHORIZATION_STATUSES;
module.exports.CONTACT_AUTHORIZATION_SCOPES = CONTACT_AUTHORIZATION_SCOPES;
module.exports.CONTACT_AUTHORIZATION_DOSSIER_TYPES = CONTACT_AUTHORIZATION_DOSSIER_TYPES;

