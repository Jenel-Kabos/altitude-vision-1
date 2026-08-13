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
const { resolveActiveOperator } = require('../platformOperator/platformOperatorService');

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

// PLATFORM-ADMIN-1 — Un PlatformOperator actif n'appartient, par construction
// correcte, à AUCUN tenant (voir PLATFORM_ADMIN_1_AUDIT.md §2 — c'est
// exactement la cause des 403 historiques). Cette fonction est le SEUL point
// où la capacité opérateur influence la résolution — jamais dupliquée
// ailleurs (middleware, contrôleurs) pour garder une unique source de
// vérité. Deux issues possibles, jamais une troisième :
//   - tenant demandé + opérateur actif → tenant résolu par ID SEUL (aucun
//     filtre de statut ni d'appartenance — un opérateur doit pouvoir
//     administrer un tenant suspendu/en archivage), source distincte
//     `platform_operator_selection` pour audit ;
//   - aucun tenant demandé + opérateur actif → AUCUN tenant retourné
//     (`tenant: null`), mais avec `source: 'platform_operator_unscoped'` —
//     jamais confondu avec l'échec ordinaire (`null` complet) : un appelant
//     qui sait lire cette source peut légitimement basculer en mode
//     plateforme pour les capacités qui le permettent nativement (ex.
//     reporting exécutif) ; un appelant qui l'ignore traite `tenant: null`
//     exactement comme avant (fail-closed inchangé pour tout code qui ne
//     connaît pas encore cette distinction).
async function resolvePlatformOperatorTenantContext(userId, requestedTenantId) {
  const operator = await resolveActiveOperator(userId).catch(() => null);
  if (!operator) return undefined; // undefined = « pas un opérateur », laisse la résolution normale se poursuivre
  if (requestedTenantId) {
    const tenant = await PlatformTenant.findById(requestedTenantId).lean().catch(() => null);
    return tenant ? { tenant, source: 'platform_operator_selection', operator } : { tenant: null, source: 'platform_operator_tenant_not_found', operator };
  }
  return { tenant: null, source: 'platform_operator_unscoped', operator };
}

async function resolveEffectiveTenantContext(userId, requestedTenantId = null) {
  const operatorContext = await resolvePlatformOperatorTenantContext(userId, requestedTenantId);
  if (operatorContext !== undefined) return operatorContext;

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
//
// `allowAnyStatus` (PLATFORM-ADMIN-1) : par défaut, seul un tenant
// `trial`/`active` est scopable (comportement historique inchangé pour tout
// appelant existant). Un PlatformOperator qui a explicitement sélectionné un
// tenant (déjà résolu par ID seul, sans filtre de statut, voir
// `resolvePlatformOperatorTenantContext`) doit pouvoir administrer un tenant
// `suspended`/`archived` — sinon `req.platformTenant` serait renseigné mais
// `req.tenantScopeUserIds` resterait `null`, une incohérence silencieuse.
// Seul `requireTenantScope` passe `true`, et uniquement pour une source
// `platform_operator_*` déjà authentifiée comme telle.
async function resolveTenantScope(tenantId, { allowAnyStatus = false } = {}) {
  if (!tenantId) return { tenant: null, scopeUserIds: null, rootOrgUnitId: null };
  const query = allowAnyStatus ? { _id: tenantId } : { _id: tenantId, status: { $in: ['trial', 'active'] } };
  const tenant = await PlatformTenant.findOne(query).lean();
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
  resolvePlatformOperatorTenantContext,
};
