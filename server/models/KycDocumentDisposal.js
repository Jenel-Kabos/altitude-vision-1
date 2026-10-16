// F-U1.J — Journal des suppressions de justificatifs KYC chez le prestataire.
//
// Une entrée par objet stocké à supprimer (orphelin d'un téléversement
// avorté, pièce d'un dossier clos arrivé à échéance). La suppression de la
// référence Mongo n'intervient QU'APRÈS la preuve de suppression prestataire
// (`proof.providerResult`). Les échecs restent `failed`, rejouables.

const mongoose = require('mongoose');
const privateAssetSchema = require('./schemas/privateAssetSchema');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  kycCase: { type: ObjectId, ref: 'FinancialIdentityKycCase', required: true, index: true },
  docId: { type: String, default: null },
  assetKey: { type: String, required: true },
  asset: { type: privateAssetSchema, select: false },
  reason: { type: String, enum: ['ORPHAN_UPLOAD', 'RETENTION_EXPIRED'], required: true },
  status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending', index: true },
  attempts: { type: Number, default: 0 },
  lastErrorCode: { type: String, default: null },
  proof: { providerResult: { type: String, default: null }, at: { type: Date, default: null }, cdnInvalidationRequested: { type: Boolean, default: false } },
}, { timestamps: true });

schema.index({ assetKey: 1 }, { unique: true });

module.exports = mongoose.model('KycDocumentDisposal', schema);
