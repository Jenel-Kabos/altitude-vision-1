// TENANT-CORE-1 (Phase 6) — Socle d'abonnement. AUCUN paiement réel : ni
// CinetPay (déjà utilisé ailleurs sur la plateforme pour les visites/
// hôtellerie) ni un nouveau fournisseur ne sont intégrés ici — uniquement
// le moteur (plan, quotas, dates, statut). Un seul abonnement ACTIF/TRIALING
// à la fois par tenant (voir index) ; changer de plan crée une nouvelle
// entrée et clôt l'ancienne (même patron que MarketingTemplate : jamais une
// édition en place d'un abonnement déjà potentiellement facturé).
const mongoose = require('mongoose');
const { PLATFORM_TENANT_PLANS, PLATFORM_TENANT_SUBSCRIPTION_STATUSES, TENANT_FEATURE_MODULES } = require('../constants/platformTenantConstants');

// Quotas par défaut, indicatifs — jamais appliqués en dur ailleurs dans le
// code métier (aucun contrôleur existant ne vérifie de quota aujourd'hui,
// voir rapport final §Dettes) : ce sont des VALEURS de configuration, pas
// encore un mécanisme d'application.
const DEFAULT_QUOTAS_BY_PLAN = {
  trial: { maxUsers: 5, maxOrgUnits: 5, maxApiKeys: 1 },
  starter: { maxUsers: 20, maxOrgUnits: 20, maxApiKeys: 3 },
  pro: { maxUsers: 100, maxOrgUnits: 100, maxApiKeys: 10 },
  enterprise: { maxUsers: null, maxOrgUnits: null, maxApiKeys: null }, // null = illimité, jamais 0 ou -1 ambigu
};

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', required: true },
  plan: { type: String, enum: PLATFORM_TENANT_PLANS, required: true },
  status: { type: String, enum: PLATFORM_TENANT_SUBSCRIPTION_STATUSES, default: 'trialing', index: true },
  modulesIncluded: { type: [String], enum: TENANT_FEATURE_MODULES, default: [] },
  quotas: {
    maxUsers: { type: Number, default: null, min: 0 },
    maxOrgUnits: { type: Number, default: null, min: 0 },
    maxApiKeys: { type: Number, default: null, min: 0 },
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null },
  cancellationReason: { type: String, maxlength: 1000, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

schema.index({ tenant: 1, status: 1 });
// Un seul abonnement trialing/active à la fois par tenant.
schema.index(
  { tenant: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['trialing', 'active'] } } },
);

module.exports = mongoose.model('PlatformTenantSubscription', schema);
module.exports.DEFAULT_QUOTAS_BY_PLAN = DEFAULT_QUOTAS_BY_PLAN;
