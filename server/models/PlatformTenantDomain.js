// TENANT-CORE-1 (Phase 5) — Domaine(s) associés à un PlatformTenant.
// Stockage et suivi de statut UNIQUEMENT — aucune automatisation DNS/SSL
// réelle n'existe (hors périmètre technique), jamais simulée comme si elle
// l'était : `status` reste 'pending' tant qu'aucune vérification manuelle
// n'a été enregistrée (voir platformTenantService.verifyDomain).
const mongoose = require('mongoose');

const DOMAIN_STATUSES = ['pending', 'verified', 'failed'];

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', required: true, index: true },
  domain: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 253 },
  isPrimary: { type: Boolean, default: false },
  status: { type: String, enum: DOMAIN_STATUSES, default: 'pending', index: true },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

schema.index({ tenant: 1, isPrimary: 1 });

module.exports = mongoose.model('PlatformTenantDomain', schema);
module.exports.DOMAIN_STATUSES = DOMAIN_STATUSES;
