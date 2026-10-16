// F-U1.G / F-U1.H — Habilitation nominative à une capacité contractuelle
// SENSIBLE.
//
// Aucune capacité sensible n'est dérivée d'un rôle (User.role, Admin `*`,
// legacy.full), d'une capacité opérateur (platform.finance.manage) ni d'une
// appartenance : seule une habilitation `active`, dans sa fenêtre de validité,
// dont le bénéficiaire reste éligible au moment de l'usage, ouvre la capacité.
//
// Cycle (double contrôle) : proposée par un gouverneur habilité, approuvée par
// un second gouverneur distinct du proposant et du bénéficiaire ; si
// l'indépendance des trois personnes n'est pas établie, l'habilitation reste
// `pending_independence`. Révocation et suspension sont immédiates et
// unilatérales (jamais besoin de garder un droit dangereux actif). Historique
// des décisions conservé sur le document (jamais supprimé).

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const historySchema = new mongoose.Schema({
  action: { type: String, required: true },
  from: { type: String, default: null },
  to: { type: String, required: true },
  actor: { type: ObjectId, ref: 'User', default: null },
  reason: { type: String, trim: true, maxlength: 1000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  user: { type: ObjectId, ref: 'User', required: true, index: true },
  scopeType: { type: String, enum: Object.values(C.GRANT_SCOPE_TYPES), required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null },
  capability: { type: String, required: true },
  status: { type: String, enum: Object.values(C.GRANT_STATUSES), required: true, index: true },
  justification: { type: String, required: true, trim: true, maxlength: 1000 },
  decisionReference: { type: String, trim: true, maxlength: 300 },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  proposedBy: { type: ObjectId, ref: 'User', required: true },
  proposedAt: { type: Date, required: true },
  proposalKey: { type: String, required: true, maxlength: 200 },
  approvedBy: { type: ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  activatedAt: { type: Date, default: null },
  refusedBy: { type: ObjectId, ref: 'User', default: null },
  refusedAt: { type: Date, default: null },
  suspendedBy: { type: ObjectId, ref: 'User', default: null },
  suspendedAt: { type: Date, default: null },
  revokedBy: { type: ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  bootstrap: { type: ObjectId, ref: 'ContractualGrantBootstrap', default: null },
  // F-U1.I — attestations d'identité sur lesquelles repose l'indépendance
  // établie : l'habilitation devient inutilisable dès que l'une d'elles est
  // suspendue, révoquée ou expirée.
  identityBasis: [{ _id: false, user: { type: ObjectId, ref: 'User' }, attestation: { type: ObjectId, ref: 'HumanIdentityAttestation' } }],
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

schema.path('tenant').validate(function tenantMatchesScope(value) {
  return this.scopeType === C.GRANT_SCOPE_TYPES.TENANT ? Boolean(value) : value == null;
}, 'tenant est requis pour une habilitation TENANT et interdit pour une habilitation PLATFORM.');
schema.path('validUntil').validate(function untilAfterFrom(value) {
  return value > this.validFrom;
}, 'validUntil doit être postérieure à validFrom.');

// Une seule habilitation vivante par (bénéficiaire, périmètre, capacité) :
// deux propositions identiques simultanées ne peuvent pas coexister.
schema.index(
  { user: 1, scopeType: 1, tenant: 1, capability: 1 },
  { unique: true, partialFilterExpression: { status: { $in: C.LIVE_GRANT_STATUSES } } },
);
schema.index({ proposedBy: 1, proposalKey: 1 }, { unique: true });
schema.index({ scopeType: 1, tenant: 1, status: 1 });

module.exports = mongoose.model('ContractualFinanceGrant', schema);
