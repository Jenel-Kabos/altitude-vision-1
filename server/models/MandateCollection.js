// F-U1.D — Constatation d'un loyer encaissé sous mandat.
//
//   - AGENCY_COLLECTION : adossée à un FinancialPayment `succeeded` (argent
//     reçu par le mandataire pour le compte du propriétaire). Statut
//     `confirmed` dès la constatation.
//   - OWNER_DIRECT : le locataire a payé directement le propriétaire.
//     `declared` (déclaration non probante) → `owner_confirmed` (corroboration
//     du propriétaire, toujours sans effet financier) → `reconciled` (pièce
//     émise par un tiers, référence, montant vérifiés par une personne
//     habilitée distincte) ou `rejected`. Aucun encaissement n'est
//     comptabilisé chez le mandataire.
//
// La commission (10 %) et la répartition des frais ne sont figées qu'à l'état
// confirmed / reconciled, à partir du snapshot de la version de mandat en
// vigueur à la date du paiement.

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');
const { FINANCIAL_CURRENCIES } = require('../constants/financialConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const evidenceSchema = new mongoose.Schema({
  documentRef: { type: String, required: true, trim: true, maxlength: 300 },
  kind: { type: String, enum: Object.values(C.COLLECTION_EVIDENCE_KINDS), default: C.COLLECTION_EVIDENCE_KINDS.OTHER },
  sha256: { type: String, trim: true, match: /^[a-f0-9]{64}$/ },
  label: { type: String, trim: true, maxlength: 200 },
}, { _id: false });

const schema = new mongoose.Schema({
  mandataryType: { type: String, enum: Object.values(C.MANDATARY_TYPES), required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  mandate: { type: ObjectId, ref: 'ManagementMandate', required: true, index: true },
  mandateVersion: { type: ObjectId, ref: 'ManagementMandateVersion', required: true },
  termsHash: { type: String, required: true },
  property: { type: ObjectId, ref: 'Property', required: true },
  owner: { type: ObjectId, ref: 'User', required: true },
  lease: { type: ObjectId, ref: 'Contrat', default: null },
  rentPeriod: { month: { type: Number, min: 1, max: 12, required: true }, year: { type: Number, required: true } },
  collectionMode: { type: String, enum: Object.values(C.COLLECTION_MODES), required: true },
  financialPayment: { type: ObjectId, ref: 'FinancialPayment', default: null },
  paymentMethod: { type: String, required: true },
  provider: { type: String, default: null },
  currency: { type: String, enum: FINANCIAL_CURRENCIES, required: true },
  grossAmountMinor: { type: Number, required: true, min: 1 },
  paidAt: { type: Date, required: true },
  status: { type: String, enum: Object.values(C.COLLECTION_RECORD_STATUSES), required: true, index: true },
  breakdown: {
    commissionBasisPoints: Number,
    commissionMinor: Number,
    clientMoneyHeldMinor: Number,
    ownerShareMinor: Number,
    feeSnapshot: mongoose.Schema.Types.Mixed,
  },
  declaration: {
    declaredBy: { type: ObjectId, ref: 'User' },
    declaredAt: Date,
    reference: { type: String, trim: true, maxlength: 200 },
    evidence: { type: [evidenceSchema], default: undefined },
  },
  // Corroboration du propriétaire : utile, jamais suffisante (F-U1.G).
  ownerConfirmation: {
    confirmedBy: { type: ObjectId, ref: 'User' },
    representation: { type: ObjectId, ref: 'OwnerRepresentation' },
    confirmedAt: Date,
  },
  reconciliation: {
    method: { type: String, enum: ['AGENT_VERIFIED_EVIDENCE'] },
    providerReference: { type: String, trim: true, maxlength: 200 },
    verifiedAmountMinor: Number,
    verifiedPaidAt: Date,
    evidence: { type: [evidenceSchema], default: undefined },
    reconciledBy: { type: ObjectId, ref: 'User' },
    reconciledAt: Date,
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  recognizedBy: { type: ObjectId, ref: 'User', required: true },
  businessOperationKey: { type: String, required: true, maxlength: 240 },
}, { timestamps: true, minimize: false });

schema.path('grossAmountMinor').validate(Number.isSafeInteger, 'grossAmountMinor doit être un entier sûr.');
schema.index({ businessOperationKey: 1 }, { unique: true });
schema.index({ financialPayment: 1 }, { unique: true, partialFilterExpression: { financialPayment: { $type: 'objectId' } } });

module.exports = mongoose.model('MandateCollection', schema);
