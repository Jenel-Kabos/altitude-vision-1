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

async function resolveAvailableTenantsForUser(userId) {
  if (!userId) return null;
  const memberships = await OrgMembership.find({ user: userId, status: 'active' }).select('orgUnit').lean();
  if (!memberships.length) return [];
  const units = await OrgUnit.find({ _id: { $in: memberships.map((item) => item.orgUnit) }, status: 'active' })
    .select('_id type ancestors').lean();
  const rootCandidates = new Set();
  for (const unit of units) {
    if (unit.type === 'organization') rootCandidates.add(String(unit._id));
    else unit.ancestors?.forEach((id) => rootCandidates.add(String(id)));
  }
  if (!rootCandidates.size) return [];
  const roots = await OrgUnit.find({ _id: { $in: [...rootCandidates] }, type: 'organization', status: 'active' }).distinct('_id');
  return PlatformTenant.find({ rootOrgUnit: { $in: roots }, status: { $in: ['trial', 'active'] } }).sort({ _id: 1 }).lean();
}

// Une appartenance unique peut être résolue implicitement. Dès qu'un
// utilisateur appartient à plusieurs tenants, le contexte doit être choisi
// explicitement et validé côté serveur : jamais de `findOne()` arbitraire.
async function resolveTenantForUser(userId, requestedTenantId = null) {
  const tenants = await resolveAvailableTenantsForUser(userId);
  if (!tenants?.length) return null;
  if (requestedTenantId) return tenants.find((tenant) => String(tenant._id) === String(requestedTenantId)) || null;
  return tenants.length === 1 ? tenants[0] : null;
}

// Résout un `tenantId` explicite (ex: paramètre de requête) en
// `{ tenant, scopeUserIds }` — même forme que `resolveOrgScope` déjà
// utilisé par reportingService.js, pour un branchement immédiat.
async function resolveTenantScope(tenantId) {
  if (!tenantId) return { tenant: null, scopeUserIds: null, rootOrgUnitId: null };
  const tenant = await PlatformTenant.findOne({ _id: tenantId, status: { $in: ['trial', 'active'] } }).lean();
  if (!tenant) return { tenant: null, scopeUserIds: null, rootOrgUnitId: null };
  const scopeUserIds = await getScopeUserIds(tenant.rootOrgUnit).catch(() => null);
  return { tenant, scopeUserIds, rootOrgUnitId: String(tenant.rootOrgUnit) };
}

module.exports = { resolveTenantForUser, resolveAvailableTenantsForUser, resolveTenantScope, resolveRootOrgUnitId };
