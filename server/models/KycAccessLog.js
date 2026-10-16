// F-U1.I — Journal append-only des consultations sensibles d'un dossier KYC
// (lecture de dossier par un vérificateur, lecture de justificatif par
// quiconque). Aucune donnée personnelle n'y est recopiée.

const mongoose = require('mongoose');
const appendOnlyPlugin = require('./schemas/appendOnlyPlugin');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  kycCase: { type: ObjectId, ref: 'FinancialIdentityKycCase', required: true, index: true },
  actor: { type: ObjectId, ref: 'User', required: true },
  accessorRole: { type: String, enum: ['SUBJECT', 'TENANT_PREPARER', 'PLATFORM_REVIEWER'], required: true },
  action: { type: String, enum: ['VIEW_CASE', 'VIEW_DOCUMENT'], required: true },
  docId: { type: String, default: null },
  at: { type: Date, default: Date.now },
}, { timestamps: false });

appendOnlyPlugin(schema, { errorCode: 'KYC_ACCESS_LOG_IMMUTABLE' });

module.exports = mongoose.model('KycAccessLog', schema);
