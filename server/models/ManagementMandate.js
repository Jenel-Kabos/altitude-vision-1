// F-U1.B — Mandat de gestion (en-tête).
//
// Identité, parties et cycle de vie du mandat. Les clauses financières vivent
// dans ManagementMandateVersion (immuable) : une modification contractuelle
// crée une nouvelle version, jamais une réécriture.
//
// `mandataryType` désigne explicitement le mandataire : PLATFORM (Altitude
// Vision gère directement) ou TENANT (organisation cliente). L'absence de
// tenant n'est JAMAIS interprétée comme un droit plateforme : un mandat
// PLATFORM porte `tenant: null` ET `mandataryType: 'PLATFORM'`.
//
// Les champs historiques RentalManagement.managementFee / mandateStartAt /
// mandateEndAt ne sont ni lus ni écrits ici (aucune migration).

const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const statusHistorySchema = new mongoose.Schema({
  from: { type: String, enum: [...Object.values(C.MANDATE_STATUSES), null] },
  to: { type: String, enum: Object.values(C.MANDATE_STATUSES), required: true },
  actor: { type: ObjectId, ref: 'User', required: true },
  reason: { type: String, trim: true, maxlength: 1000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  mandataryType: { type: String, enum: Object.values(C.MANDATARY_TYPES), required: true },
  tenant: { type: ObjectId, ref: 'PlatformTenant', default: null, index: true },
  owner: { type: ObjectId, ref: 'User', required: true, index: true },
  property: { type: ObjectId, ref: 'Property', required: true },
  rentalManagement: { type: ObjectId, ref: 'RentalManagement', default: null },
  reference: { type: String, required: true, trim: true, maxlength: 120 },
  status: { type: String, enum: Object.values(C.MANDATE_STATUSES), default: C.MANDATE_STATUSES.DRAFT, index: true },
  currentVersion: { type: ObjectId, ref: 'ManagementMandateVersion', default: null },
  currentVersionNumber: { type: Number, default: 0, min: 0 },
  statusHistory: { type: [statusHistorySchema], default: [] },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  businessOperationKey: { type: String, required: true, maxlength: 200 },
}, { timestamps: true });

schema.path('tenant').validate(function tenantMatchesMandatary(value) {
  return this.mandataryType === C.MANDATARY_TYPES.TENANT ? Boolean(value) : value == null;
}, 'tenant est requis pour un mandataire TENANT et interdit pour un mandataire PLATFORM.');

// Un seul mandat vivant par bien.
schema.index({ property: 1 }, { unique: true, partialFilterExpression: { status: { $in: C.LIVE_MANDATE_STATUSES } } });
schema.index({ businessOperationKey: 1 }, { unique: true });
schema.index({ reference: 1, mandataryType: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('ManagementMandate', schema);
