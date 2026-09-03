const mongoose = require('mongoose');
const privateAssetSchema = require('./schemas/privateAssetSchema');

const STATES = Object.freeze([
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW',
  'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'REJECTED',
]);
const ACTIVE_STATES = Object.freeze(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED']);
const DOCUMENT_CATEGORIES = Object.freeze([
  'responsible_person_identity',
  'professional_business_existence',
  'establishment_authority',
  'establishment_context',
]);

const historySchema = new mongoose.Schema({
  from: { type: String, enum: [...STATES, null], default: null },
  to: { type: String, enum: STATES, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, trim: true, maxlength: 1000, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true },
  organizationName: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
  organizationType: { type: String, trim: true, maxlength: 80, default: '' },
  professionalContact: {
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    country: { type: String, trim: true, maxlength: 100, default: 'Congo' },
  },
  businessDeclaration: { type: String, trim: true, maxlength: 3000, default: '' },
  establishmentContext: {
    name: { type: String, trim: true, maxlength: 200, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
  },
  status: { type: String, enum: STATES, default: 'DRAFT', required: true, index: true },
  submittedAt: { type: Date, default: null },
  activeApplicantKey: { type: String, default: null, select: false },
  reopenedFields: [{ type: String, maxlength: 100 }],
  additionalInfo: {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    requestedAt: { type: Date, default: null },
    reason: { type: String, trim: true, maxlength: 1000, default: '' },
    requestedDocumentCategories: [{ type: String, enum: DOCUMENT_CATEGORIES }],
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, maxlength: 1000, default: '' },
  provisionedTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null },
  provisionedMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'OrgMembership', default: null },
  provisioningKey: { type: String, trim: true, maxlength: 100, default: null, select: false },
  revision: { type: Number, default: 1, min: 1 },
  history: { type: [historySchema], default: [] },
  attachmentManifest: [{
    category: { type: String, enum: DOCUMENT_CATEGORIES, required: true },
    revision: { type: Number, min: 1, required: true },
    privateAsset: { type: privateAssetSchema, select: false },
    displayName: { type: String, trim: true, maxlength: 180, default: 'document' },
    supersedes: { type: mongoose.Schema.Types.ObjectId, default: null },
    deletionState: { type: String, enum: ['active', 'pending', 'cleanup_failed'], default: 'active' },
    uploadedAt: { type: Date, default: Date.now },
  }],
  storageCleanupQueue: [{
    privateAsset: { type: privateAssetSchema, select: false },
    reason: { type: String, maxlength: 200, default: 'upload_persistence_failed' },
    recordedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

schema.index({ activeApplicantKey: 1 }, {
  unique: true,
  partialFilterExpression: { activeApplicantKey: { $type: 'string' } },
});
schema.index({ applicant: 1, createdAt: -1 });
schema.index({ status: 1, submittedAt: 1 });

module.exports = mongoose.model('TenantApplication', schema);
module.exports.TENANT_APPLICATION_STATES = STATES;
module.exports.TENANT_APPLICATION_ACTIVE_STATES = ACTIVE_STATES;
module.exports.TENANT_APPLICATION_DOCUMENT_CATEGORIES = DOCUMENT_CATEGORIES;
