// TENANT-CORE-1 (Phase 5/6) — Modules activés par PlatformTenant. Une seule
// entrée par (tenant, module) — l'absence d'entrée signifie "non activé"
// (jamais un défaut implicite "tout activé", pour qu'un plan d'abonnement
// restreint — voir PlatformTenantSubscription.modulesIncluded — se
// traduise réellement en fonctionnalités absentes du tableau de bord).
const mongoose = require('mongoose');
const { TENANT_FEATURE_MODULES } = require('../constants/platformTenantConstants');

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', required: true, index: true },
  module: { type: String, enum: TENANT_FEATURE_MODULES, required: true },
  enabled: { type: Boolean, default: true },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  grantedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ tenant: 1, module: 1 }, { unique: true });

module.exports = mongoose.model('PlatformTenantFeature', schema);
