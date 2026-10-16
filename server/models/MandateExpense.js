// F-U1.C — Dépense engagée au titre d'un mandat de gestion déléguée.
//
// Une dépense est toujours rattachée à une intervention (RentalMaintenanceTicket)
// du bien sous mandat : toutes les dépenses d'une même intervention sont
// cumulées pour le plafond par intervention (anti-fractionnement).
//
// Cycle : pending_owner_authorization | committed → authorized → justified,
// avec refused / cancelled terminaux. Seule une dépense `justified` (montant
// réel + justificatifs) est déductible du solde propriétaire.

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');
const { FINANCIAL_CURRENCIES } = require('../constants/financialConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const evidenceSchema = new mongoose.Schema({
  documentRef: { type: String, required: true, trim: true, maxlength: 300 },
  sha256: { type: String, trim: true, match: /^[a-f0-9]{64}$/ },
  label: { type: String, trim: true, maxlength: 200 },
}, { _id: false });

const historySchema = new mongoose.Schema({
  from: String,
  to: { type: String, required: true },
  action: { type: String, required: true },
  actor: { type: ObjectId, ref: 'User', required: true },
  amountMinor: Number,
  comment: { type: String, trim: true, maxlength: 1000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  mandataryType: { type: String, enum: Object.values(C.MANDATARY_TYPES), required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  mandate: { type: ObjectId, ref: 'ManagementMandate', required: true, index: true },
  mandateVersion: { type: ObjectId, ref: 'ManagementMandateVersion', required: true },
  termsHash: { type: String, required: true },
  capsSnapshot: {
    perInterventionMinor: { type: Number, required: true },
    monthlyCumulativeMinor: { type: Number, required: true },
    period: { type: String, required: true },
  },
  property: { type: ObjectId, ref: 'Property', required: true, index: true },
  owner: { type: ObjectId, ref: 'User', required: true },
  intervention: { type: ObjectId, ref: 'RentalMaintenanceTicket', required: true, index: true },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  currency: { type: String, enum: FINANCIAL_CURRENCIES, required: true },
  requestedAmountMinor: { type: Number, required: true, min: 1 },
  reservedAmountMinor: { type: Number, default: 0, min: 0 },
  justifiedAmountMinor: { type: Number, default: null, min: 0 },
  monthKey: { type: String, required: true },
  capBreaches: [{ type: String, enum: Object.values(C.EXPENSE_CAP_BREACHES) }],
  // Observation au moment de la demande (montants déjà réservés).
  capObservation: {
    interventionReservedBeforeMinor: Number,
    monthReservedBeforeMinor: Number,
  },
  status: { type: String, enum: Object.values(C.EXPENSE_STATUSES), required: true, index: true },
  authorization: { type: ObjectId, ref: 'ExpenseAuthorization', default: null },
  evidence: { type: [evidenceSchema], default: [] },
  requestedBy: { type: ObjectId, ref: 'User', required: true },
  justifiedBy: { type: ObjectId, ref: 'User', default: null },
  justifiedAt: { type: Date, default: null },
  history: { type: [historySchema], default: [] },
  idempotencyKey: { type: String, required: true, maxlength: 200 },
  payloadHash: { type: String, required: true, select: false },
}, { timestamps: true });

['requestedAmountMinor', 'reservedAmountMinor', 'justifiedAmountMinor'].forEach((path) => {
  schema.path(path).validate((value) => value == null || Number.isSafeInteger(value), `${path} doit être un entier sûr.`);
});
schema.index({ mandate: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ mandate: 1, property: 1, monthKey: 1, status: 1 });

module.exports = mongoose.model('MandateExpense', schema);
