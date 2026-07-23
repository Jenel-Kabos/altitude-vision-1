const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema({
  financialDocument: { type: ObjectId, ref: 'FinancialDocument', required: true },
  domain: { type: String, required: true, enum: ['hotel', 'real_estate', 'rental'] },
  establishmentId: { type: ObjectId, required: true },
  reservationId: { type: ObjectId, ref: 'HotelReservation', default: null },
  artifactType: { type: String, enum: ['official_invoice_pdf'], required: true },
  templateVersion: { type: String, required: true },
  snapshotHash: { type: String, required: true, minlength: 64, maxlength: 64 },
  status: { type: String, enum: ['pending', 'ready', 'failed', 'superseded'], required: true, default: 'pending' },
  storageProvider: { type: String, enum: ['cloudinary'], default: 'cloudinary' },
  storageKey: { type: String, default: null, select: false },
  storageVersion: { type: String, default: null, select: false },
  hashAlgorithm: { type: String, enum: ['sha256'], default: 'sha256' },
  hash: { type: String, default: null, minlength: 64, maxlength: 64 },
  mimeType: { type: String, enum: ['application/pdf'], default: 'application/pdf' },
  sizeBytes: { type: Number, min: 1, default: null },
  generator: { type: String, default: 'pdfkit' },
  generatedAt: { type: Date, default: null },
  generatedBy: { type: ObjectId, ref: 'User', required: true },
  generationToken: { type: String, required: true, select: false },
  idempotencyKeyHash: { type: String, default: null, select: false },
  failureCode: { type: String, default: null },
  failureMessage: { type: String, default: null, maxlength: 500 },
}, { timestamps: true });

schema.index(
  { financialDocument: 1, artifactType: 1, templateVersion: 1, snapshotHash: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'ready'] } } },
);
schema.index({ establishmentId: 1, createdAt: -1 });
schema.index({ idempotencyKeyHash: 1 }, { unique: true, partialFilterExpression: { idempotencyKeyHash: { $type: 'string' } } });
schema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function preventArtifactDeletion() { throw new Error('FINANCIAL_ARTIFACT_APPEND_ONLY'); });

module.exports = mongoose.model('FinancialDocumentArtifact', schema);
