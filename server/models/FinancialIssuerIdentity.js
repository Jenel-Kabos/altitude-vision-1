// F-U1 §12 — Identité légale d'un émetteur de documents financiers.
//
// Configurable et versionnée ; seule une identité `verified` (vérifiée par une
// personne distincte de celle qui l'a saisie) peut être apposée sur un
// document juridiquement opposable. La qualité d'émetteur dépend du contrat et
// du service : aucun document n'utilise implicitement l'identité plateforme.

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  scope: { type: String, enum: Object.values(C.ISSUER_SCOPES), required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  version: { type: Number, required: true, min: 1 },
  legalName: { type: String, required: true, trim: true, maxlength: 200 },
  rccm: { type: String, required: true, trim: true, maxlength: 80 },
  niu: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, trim: true, maxlength: 40 },
  address: { type: String, required: true, trim: true, maxlength: 400 },
  status: { type: String, enum: Object.values(C.ISSUER_IDENTITY_STATUSES), default: C.ISSUER_IDENTITY_STATUSES.UNVERIFIED, index: true },
  source: { type: String, trim: true, maxlength: 300 },
  registeredBy: { type: ObjectId, ref: 'User', required: true },
  verifiedBy: { type: ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  verificationEvidenceRef: { type: String, trim: true, maxlength: 300 },
}, { timestamps: true });

schema.path('tenant').validate(function tenantMatchesScope(value) {
  return this.scope === C.ISSUER_SCOPES.TENANT ? Boolean(value) : value == null;
}, 'tenant est requis pour un émetteur TENANT et interdit pour un émetteur PLATFORM.');
schema.index({ scope: 1, tenant: 1, version: 1 }, { unique: true });
schema.index({ scope: 1, tenant: 1 }, { unique: true, partialFilterExpression: { status: 'verified' } });

module.exports = mongoose.model('FinancialIssuerIdentity', schema);
