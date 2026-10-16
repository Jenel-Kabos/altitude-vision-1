// F-U2.10 — Pénalité de retard de 3 % sur le loyer principal impayé à
// l'expiration du 5 du mois suivant. Une évaluation par échéance (index
// unique) : ni pénalité quotidienne, ni composée, ni pénalité sur pénalité.
// Base juridique non validée → statut SIMULATED : montant prévisionnel,
// jamais une créance exigible ni une ligne de facture.

const mongoose = require('mongoose');
const { PENALTY_STATUSES } = require('../constants/rentCollectionConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  rentDocument: { type: ObjectId, ref: 'FinancialDocument', required: true },
  kind: { type: String, enum: ['LATE_PAYMENT'], default: 'LATE_PAYMENT' },
  lease: { type: ObjectId, ref: 'Contrat', default: null },
  property: { type: ObjectId, ref: 'Property', required: true },
  owner: { type: ObjectId, ref: 'User', default: null },
  locataire: { type: ObjectId, ref: 'Locataire', default: null },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  scope: { mandataryType: String, tenant: { type: ObjectId, default: null } },
  period: { type: String, required: true },
  assessedAt: { type: Date, required: true },
  lateFrom: { type: Date, required: true },
  rentPrincipalMinor: { type: Number, required: true, min: 0 },
  paidRentAtDeadlineMinor: { type: Number, required: true, min: 0 },
  baseMinor: { type: Number, required: true, min: 0 },
  rateBasisPoints: { type: Number, required: true },
  penaltyMinor: { type: Number, required: true, min: 0 },
  policyVersion: { type: String, required: true },
  imputationRule: { type: String, required: true },
  status: { type: String, enum: PENALTY_STATUSES, required: true },
  legalBasis: { status: { type: String, default: 'NOT_VALIDATED' }, contractClauseReference: { type: String, default: null } },
  // F-U2.11 — imputation loyer/charges retenue et fourchette si indéterminée.
  imputation: { type: String, default: null },
  penaltyRangeMinor: { min: { type: Number, default: null }, max: { type: Number, default: null } },
  // F-U2.11 — origine : moteur canonique ; pénalité historique (`Paiement`)
  // rattachée pour rapprochement, jamais recalculée ni annulée.
  engine: { type: String, default: 'CANONICAL' },
  // F-U2.13 — politique contractuelle appliquée (jamais une valeur globale).
  policy: { id: { type: ObjectId, ref: 'LeaseContractualPolicy', default: null }, type: { type: String, default: null }, version: { type: Number, default: null }, reason: { type: String, default: null } },
  legacyPenalty: { paiement: { type: ObjectId, ref: 'Paiement', default: null }, penaliteMontant: { type: Number, default: null }, detectedAt: { type: Date, default: null } },
  // F-U2.11 — corrections tracées (allocation tardive d'un paiement confirmé
  // à temps, contrepassation, imputation résolue). Une pénalité validée
  // juridiquement n'est jamais modifiée : ajustement en attente de décision.
  corrections: [{
    _id: false, at: Date, reason: String,
    previous: { baseMinor: Number, penaltyMinor: Number, status: String },
    next: { baseMinor: Number, penaltyMinor: Number, status: String },
  }],
  pendingAdjustment: { at: { type: Date, default: null }, baseMinor: { type: Number, default: null }, penaltyMinor: { type: Number, default: null }, reason: { type: String, default: null } },
}, { timestamps: true });

['rentPrincipalMinor', 'paidRentAtDeadlineMinor', 'baseMinor', 'penaltyMinor'].forEach((path) => schema.path(path).validate(Number.isSafeInteger, `${path} doit être un entier.`));
schema.index({ rentDocument: 1, kind: 1 }, { unique: true });
schema.index({ owner: 1, period: -1 });

module.exports = mongoose.model('RentLatePenaltyAssessment', schema);
