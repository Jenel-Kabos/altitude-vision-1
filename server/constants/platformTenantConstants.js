// TENANT-CORE-1 — même convention que constants/organizationConstants.js
// (ORGANIZATION-1) : les valeurs d'enum vivent ici, jamais dupliquées dans
// le modèle et le service.
//
// TENANT_FEATURE_MODULES reprend EXACTEMENT le même vocabulaire que
// `services/reporting/reportingService.js`.DOMAINS (REPORTING-1), complété
// de 'erp' et 'api' — jamais une seconde taxonomie de modules inventée.
// Si `DOMAINS` évolue, mettre à jour cette liste en conséquence (pas
// d'import direct d'un service dans un fichier de constantes, même
// convention que le reste du codebase).
const TENANT_FEATURE_MODULES = [
  'immobilier', 'location', 'patrimoine', 'accommodation', 'hotel',
  'crm', 'finance', 'communication', 'evenementiel', 'marketing',
  'erp', 'api',
];

const PLATFORM_TENANT_PLANS = ['trial', 'starter', 'pro', 'enterprise'];
const PLATFORM_TENANT_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'cancelled'];

module.exports = { TENANT_FEATURE_MODULES, PLATFORM_TENANT_PLANS, PLATFORM_TENANT_SUBSCRIPTION_STATUSES };
