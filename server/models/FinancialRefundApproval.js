// F-U1.E — Décision individuelle d'approbation d'un remboursement gouverné.
//
// Append-only. L'index unique (refund, round, approver) interdit qu'une même
// personne approuve deux fois dans un même tour de validation ; l'initiateur
// est refusé par le service avant écriture.

const mongoose = require('mongoose');
const appendOnlyPlugin = require('./schemas/appendOnlyPlugin');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  refund: { type: ObjectId, ref: 'FinancialRefund', required: true },
  approver: { type: ObjectId, ref: 'User', required: true },
  round: { type: Number, required: true, min: 1 },
  decision: { type: String, enum: ['approved', 'refused'], required: true },
  authorityPlane: { type: String, enum: ['TENANT', 'PLATFORM'], required: true },
  comment: { type: String, trim: true, maxlength: 2000 },
  decidedAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

schema.index({ refund: 1, round: 1, approver: 1 }, { unique: true });
appendOnlyPlugin(schema, { errorCode: 'REFUND_APPROVAL_IMMUTABLE' });

module.exports = mongoose.model('FinancialRefundApproval', schema);
