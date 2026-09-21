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
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-H — commercial plans carry the
// canonical `maxManagedProperties` quota (rental-management activation
// budget). Property publication remains unlimited across all plans (Lot F
// separation invariant). `null` = illimité (jamais 0/-1 ambigu). The three
// legacy internal plans stay unchanged; existing subscriptions keep their
// current quotas unaltered.
const DEFAULT_QUOTAS_BY_PLAN = {
  trial: { maxUsers: 5, maxOrgUnits: 5, maxApiKeys: 1, maxManagedProperties: null },
  starter: { maxUsers: 20, maxOrgUnits: 20, maxApiKeys: 3, maxManagedProperties: null },
  pro: { maxUsers: 100, maxOrgUnits: 100, maxApiKeys: 10, maxManagedProperties: null },
  enterprise: { maxUsers: null, maxOrgUnits: null, maxApiKeys: null, maxManagedProperties: null },
  essentiel: { maxUsers: 5, maxOrgUnits: 5, maxApiKeys: 1, maxManagedProperties: 1 },
  professionnel: { maxUsers: 50, maxOrgUnits: 20, maxApiKeys: 5, maxManagedProperties: 20 },
  premium: { maxUsers: 200, maxOrgUnits: 50, maxApiKeys: 20, maxManagedProperties: 50 },
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
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-H — commercial rental-
    // management activation budget. `null` == illimité (backward-compatible
    // for legacy plans). Enforced by `rentalManagementQuotaService`.
    maxManagedProperties: { type: Number, default: null, min: 0 },
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
