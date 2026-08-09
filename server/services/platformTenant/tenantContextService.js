// TENANT-CORE-1 (Phase 4) — Couche d'isolation transversale. RÉSOUT à quel
// PlatformTenant appartient un utilisateur authentifié, sans jamais
// réimplémenter la logique d'appartenance : réutilise intégralement
// `OrgMembership` (ORGANIZATION-1) pour trouver la racine organisationnelle
// de l'utilisateur, puis `organizationService.getScopeUserIds` (déjà
// utilisé par CRM/Reporting/ERP/ActionLog) pour scoper.
//
// Pourquoi une fonction, pas un plugin Mongoose global : appliquer un hook
// `pre('find')` automatique à TOUTES les collections métier existantes
// (aucune ne porte de champ tenant aujourd'hui — voir audit Phase 1)
// romprait silencieusement des centaines de requêtes déjà en production
// (résultats vidés) sans qu'aucun test existant ne le détecte forcément.
// Le choix retenu — une résolution EXPLICITE, appelée là où un
// contrôleur/service veut réellement scoper — est le même que celui déjà
// validé par ORGANIZATION-1/REPORTING-1/ERP-CORE-1 pour `orgUnitId` : un
// paramètre optionnel, jamais un filtre imposé en cachette.
const OrgMembership = require('../../models/OrgMembership');
const OrgUnit = require('../../models/OrgUnit');
const PlatformTenant = require('../../models/PlatformTenant');
const { getScopeUserIds } = require('../organizationService');

// Remonte `ancestors` (déjà matérialisé par OrgUnit, voir models/OrgUnit.js)
// jusqu'à la racine (type:'organization') — au maximum une lecture, aucune
// récursion applicative.
async function resolveRootOrgUnitId(orgUnitId) {
  const unit = await OrgUnit.findById(orgUnitId).select('type ancestors').lean();
  if (!unit) return null;
  if (unit.type === 'organization') return String(unit._id);
  if (!unit.ancestors?.length) return null;
  const root = await OrgUnit.findOne({ _id: { $in: unit.ancestors }, type: 'organization' }).select('_id').lean();
  return root ? String(root._id) : null;
}

// Résout le PlatformTenant d'un utilisateur via sa première appartenance
// active — un utilisateur multi-organisation (cas déjà supporté par
// OrgMembership, voir ORGANIZATION-1) résout au premier tenant trouvé ;
// documenté comme limitation explicite (voir rapport final §Dettes), jamais
// une fusion silencieuse de plusieurs tenants.
async function resolveTenantForUser(userId) {
  if (!userId) return null;
  const membership = await OrgMembership.findOne({ user: userId, status: 'active' }).select('orgUnit').lean();
  if (!membership) return null;
  const rootOrgUnitId = await resolveRootOrgUnitId(membership.orgUnit);
  if (!rootOrgUnitId) return null;
  const tenant = await PlatformTenant.findOne({ rootOrgUnit: rootOrgUnitId, status: { $ne: 'archived' } }).lean();
  return tenant || null;
}

// Résout un `tenantId` explicite (ex: paramètre de requête) en
// `{ tenant, scopeUserIds }` — même forme que `resolveOrgScope` déjà
// utilisé par reportingService.js, pour un branchement immédiat.
async function resolveTenantScope(tenantId) {
  if (!tenantId) return { tenant: null, scopeUserIds: null, rootOrgUnitId: null };
  const tenant = await PlatformTenant.findById(tenantId).lean();
  if (!tenant) return { tenant: null, scopeUserIds: null, rootOrgUnitId: null };
  const scopeUserIds = await getScopeUserIds(tenant.rootOrgUnit).catch(() => null);
  return { tenant, scopeUserIds, rootOrgUnitId: String(tenant.rootOrgUnit) };
}

module.exports = { resolveTenantForUser, resolveTenantScope, resolveRootOrgUnitId };
