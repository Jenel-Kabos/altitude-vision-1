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
const User = require('../../models/User');
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

// Compatibilité strictement bornée pour les comptes ayant créé la racine
// Altitude Vision avant l'introduction des OrgMembership. La double preuve
// `PlatformTenant.createdBy` + `OrgUnit.createdBy`, l'antériorité du compte,
// l'absence de TOUT membership et l'unicité du résultat empêchent qu'un rôle
// (Admin ou autre) ne devienne un accès global implicite.
async function resolveLegacyTenantForUser(userId) {
  if (!userId) return null;
  const [user, membershipCount] = await Promise.all([
    User.findOne({ _id: userId, isActive: { $ne: false }, status: { $nin: ['Suspendu', 'Banni', 'Supprimé'] }, isTechnical: { $ne: true } })
      .select('_id createdAt').lean(),
    OrgMembership.countDocuments({ user: userId }),
  ]);
  if (!user || membershipCount !== 0) return null;

  const roots = await OrgUnit.find({ type: 'organization', status: 'active', createdBy: userId })
    .select('_id createdAt').lean();
  if (!roots.length) return null;
  const rootById = new Map(roots.map((root) => [String(root._id), root]));
  const tenants = await PlatformTenant.find({
    rootOrgUnit: { $in: roots.map((root) => root._id) },
    createdBy: userId,
    status: { $in: ['trial', 'active'] },
  }).sort({ _id: 1 }).lean();
  const proven = tenants.filter((tenant) => {
    const root = rootById.get(String(tenant.rootOrgUnit));
    return root && user.createdAt <= root.createdAt && user.createdAt <= tenant.createdAt;
  });
  return proven.length === 1 ? proven[0] : null;
}

async function resolveEffectiveTenantContext(userId, requestedTenantId = null) {
  const tenants = await resolveAvailableTenantsForUser(userId);
  if (requestedTenantId) {
    const tenant = tenants?.find((item) => String(item._id) === String(requestedTenantId)) || null;
    return tenant ? { tenant, source: 'explicit_membership' } : null;
  }
  if (tenants?.length === 1) return { tenant: tenants[0], source: 'single_membership' };
  if (tenants?.length > 1) return null;
  const legacyTenant = await resolveLegacyTenantForUser(userId);
  return legacyTenant ? { tenant: legacyTenant, source: 'legacy_fallback' } : null;
}

// Une appartenance unique peut être résolue implicitement. Dès qu'un
// utilisateur appartient à plusieurs tenants, le contexte doit être choisi
// explicitement et validé côté serveur : jamais de `findOne()` arbitraire.
async function resolveTenantForUser(userId, requestedTenantId = null) {
  const context = await resolveEffectiveTenantContext(userId, requestedTenantId);
  return context?.tenant || null;
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

module.exports = {
  resolveTenantForUser,
  resolveEffectiveTenantContext,
  resolveLegacyTenantForUser,
  resolveAvailableTenantsForUser,
  resolveTenantScope,
  resolveRootOrgUnitId,
};
