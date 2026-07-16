const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  from: String,
  to: String,
  action: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  source: { type: String, default: 'api' },
  comment: { type: String, trim: true, maxlength: 1000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const actionRequestSchema = new mongoose.Schema({
  type: { type: String, enum: ['publish', 'suspend', 'maintenance', 'future_availability'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedAt: { type: Date, default: Date.now },
  reason: { type: String, trim: true, maxlength: 1000 },
  plannedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewComment: { type: String, trim: true, maxlength: 1000 },
});

const rentalManagementSchema = new mongoose.Schema({
  // Property reste l'unique représentation du bien physique et de son annonce.
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, unique: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  currentTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Locataire', default: null },
  activeLease: { type: mongoose.Schema.Types.ObjectId, ref: 'Contrat', default: null },
  active: { type: Boolean, default: true, index: true },
  occupancyStatus: {
    type: String,
    enum: ['vacant', 'preavis', 'occupe', 'sortie_programmee', 'travaux', 'indisponible'],
    default: 'vacant',
    index: true,
  },
  availabilityStatus: {
    type: String,
    enum: ['disponible', 'reserve', 'loue', 'indisponible', 'maintenance', 'retire', 'vendu'],
    default: 'disponible',
    index: true,
  },
  publicationStatus: {
    type: String,
    enum: ['brouillon', 'en_attente_moderation', 'publie', 'suspendu', 'archive', 'rejete'],
    default: 'brouillon',
    index: true,
  },
  publicationPolicy: { type: String, enum: ['manuelle', 'automatique'], default: 'manuelle' },
  publicationAuthorized: { type: Boolean, default: false },
  monthlyRent: { type: Number, min: 0 },
  charges: { type: Number, min: 0, default: 0 },
  depositAmount: { type: Number, min: 0 },
  managementFee: { type: Number, min: 0 },
  mandateStartAt: Date,
  mandateEndAt: Date,
  lastPublishedAt: Date,
  lastVacatedAt: Date,
  maintenanceStatus: { type: String, enum: ['aucune', 'signalee', 'en_cours', 'controle_requis'], default: 'aucune' },
  maintenanceReason: { type: String, trim: true, maxlength: 1000 },
  noticeStartedAt: Date,
  plannedExitAt: Date,
  exitInspectionClearedAt: Date,
  publicationReadiness: {
    ready: { type: Boolean, default: false },
    missingFields: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    evaluatedAt: Date,
  },
  workflowHistory: { type: [historySchema], default: [] },
  actionRequests: { type: [actionRequestSchema], default: [] },
}, { timestamps: true });

rentalManagementSchema.index({ owner: 1, occupancyStatus: 1 });
rentalManagementSchema.index({ publicationStatus: 1, availabilityStatus: 1 });

module.exports = mongoose.model('RentalManagement', rentalManagementSchema);
