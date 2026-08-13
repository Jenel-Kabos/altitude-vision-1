// ORGANIZATION-1 (Phase 8) — Contrôleur d'administration. Délègue
// entièrement à organizationService — aucune logique métier ici.
//
// TENANT-CERT-2 — audit adversarial : ce contrôleur ne vérifiait jusqu'ici
// AUCUNE frontière tenant (uniquement `restrictTo('Admin')`/staff, un rôle
// fonctionnel). Un Admin du Tenant A pouvait lister/consulter l'arbre
// organisationnel du Tenant B, y affecter un utilisateur, ou
// suspendre/révoquer une appartenance du Tenant B — vulnérabilité confirmée
// par test adversarial (voir
// __tests__/tenantCert2.organization.adversarial.mongo.integration.test.js).
// Chaque action ciblant une OrgUnit/OrgMembership précise vérifie désormais
// que sa racine organisationnelle correspond au tenant résolu de l'acteur —
// réutilise tenantContextService (déjà la source de vérité), aucune
// seconde implémentation de résolution tenant.
const asyncHandler = require('express-async-handler');
const service = require('../services/organizationService');
const OrgUnit = require('../models/OrgUnit');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');
const { resolveTenantForUser, resolveRootOrgUnitId } = require('../services/platformTenant/tenantContextService');

class OrgTenantBoundaryError extends Error {
  constructor(message = 'Ressource organisationnelle inaccessible dans ce contexte tenant.') {
    super(message);
    this.statusCode = 404; // jamais 403 : ne pas confirmer l'existence d'une ressource hors tenant
    // errorMiddleware.js dérive le statusCode HTTP de `res.statusCode`
    // (déjà positionné) pour la plupart des erreurs, MAIS reconnaît
    // explicitement `err.name === 'OrganizationError'` (déjà utilisé par
    // organizationService.js) pour appliquer `err.statusCode` — réutilisé
    // ici tel quel plutôt que d'inventer un second mécanisme.
    this.name = 'OrganizationError';
  }
}

async function actorTenantRootId(req) {
  // PLATFORM-ADMIN-CERT-1 — sans transmission de l'en-tête, un PlatformOperator
  // (zéro OrgMembership par construction) ne pouvait JAMAIS administrer
  // l'Organisation d'aucun tenant, même après sélection explicite dans l'UI —
  // même correctif que paiementRoutes.js/contratRoutes.js/gestionDocumentRoutes.js.
  const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
  const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
  if (!tenant) throw new OrgTenantBoundaryError('Contexte tenant requis ou ambigu pour cette action.');
  return String(tenant.rootOrgUnit);
}

// Une racine organisationnelle créée directement via organizationService
// (usage antérieur à PlatformTenant, jamais passée par platformTenantService.
// createTenant) n'est enveloppée par AUCUN PlatformTenant : il n'existe donc
// aucune frontière tenant à faire respecter sur son sous-arbre — comportement
// legacy préservé à l'identique, jamais restreint rétroactivement. Dès
// qu'un PlatformTenant existe réellement pour cette racine, la frontière
// stricte s'applique.
async function assertOrgUnitInActorTenant(req, orgUnitId) {
  const resourceRoot = await resolveRootOrgUnitId(orgUnitId);
  if (!resourceRoot) throw new OrgTenantBoundaryError();
  const wrappingTenant = await PlatformTenant.findOne({ rootOrgUnit: resourceRoot, status: { $ne: 'archived' } }).select('_id').lean();
  if (!wrappingTenant) return; // legacy, aucune frontière tenant à faire respecter
  const actorRoot = await actorTenantRootId(req);
  if (resourceRoot !== actorRoot) throw new OrgTenantBoundaryError();
}

async function assertMembershipInActorTenant(req, membershipId) {
  const membership = await OrgMembership.findById(membershipId).select('orgUnit').lean();
  if (!membership) throw new OrgTenantBoundaryError('Appartenance introuvable.');
  await assertOrgUnitInActorTenant(req, membership.orgUnit);
}

const serializeUnit = (u) => ({
  id: u._id, name: u.name, type: u.type, parent: u.parent, path: u.path,
  linkedEstablishment: u.linkedEstablishment, status: u.status, createdBy: u.createdBy,
});
const serializeMembership = (m) => ({
  id: m._id, user: m.user, orgUnit: m.orgUnit, roleInUnit: m.roleInUnit, status: m.status,
  grantedBy: m.grantedBy, grantedAt: m.grantedAt,
  suspendedAt: m.suspendedAt, suspensionReason: m.suspensionReason,
  revokedAt: m.revokedAt, revocationReason: m.revocationReason,
});

// Un `parentId` fourni doit appartenir au tenant de l'acteur (frontière
// tenant réelle, sinon un Admin A pourrait greffer une unité dans l'arbre
// B). Une création de racine ('organization', sans parent) n'a en revanche
// AUCUNE victime possible : elle ne lit ni ne modifie rien appartenant à un
// tenant existant, que l'acteur en possède déjà un ou non (flux legacy déjà
// couvert par organization.mongo.integration.test.js, antérieur à
// PlatformTenant — jamais cassé par ce correctif).
exports.createOrgUnit = asyncHandler(async (req, res) => {
  if (req.body.parentId) await assertOrgUnitInActorTenant(req, req.body.parentId);
  const unit = await service.createOrgUnit({ ...req.body, actor: req.user, req });
  res.status(201).json({ status: 'success', data: { orgUnit: serializeUnit(unit) } });
});

exports.archiveOrgUnit = asyncHandler(async (req, res) => {
  await assertOrgUnitInActorTenant(req, req.params.id);
  const unit = await service.archiveOrgUnit(req.params.id, { actor: req.user, reason: req.body.reason, req });
  res.json({ status: 'success', data: { orgUnit: serializeUnit(unit) } });
});

exports.getTree = asyncHandler(async (req, res) => {
  await assertOrgUnitInActorTenant(req, req.params.id);
  const tree = await service.getOrgTree(req.params.id);
  res.json({ status: 'success', data: { tree } });
});

// Jamais un `listOrgUnits()` platform-wide exposé via HTTP : toujours
// restreint aux unités du sous-arbre tenant de l'acteur (préfixe de `path`,
// même mécanisme que organizationService.getScopeUserIds).
exports.listUnits = asyncHandler(async (req, res) => {
  const rootId = await actorTenantRootId(req);
  const root = await OrgUnit.findById(rootId).select('path').lean();
  const units = await service.listOrgUnits({ type: req.query.type, status: req.query.status });
  const scoped = units.filter((u) => String(u._id) === rootId || u.path?.startsWith(`${root.path}${rootId}/`));
  res.json({ status: 'success', data: { units: scoped.map(serializeUnit) } });
});

exports.grantMembership = asyncHandler(async (req, res) => {
  await assertOrgUnitInActorTenant(req, req.body.orgUnitId);
  const membership = await service.grantMembership({ ...req.body, actor: req.user, req });
  res.status(201).json({ status: 'success', data: { membership: serializeMembership(membership) } });
});

exports.suspendMembership = asyncHandler(async (req, res) => {
  await assertMembershipInActorTenant(req, req.params.id);
  const membership = await service.suspendMembership({ membershipId: req.params.id, actor: req.user, reason: req.body.reason, req });
  res.json({ status: 'success', data: { membership: serializeMembership(membership) } });
});

exports.revokeMembership = asyncHandler(async (req, res) => {
  await assertMembershipInActorTenant(req, req.params.id);
  const membership = await service.revokeMembership({ membershipId: req.params.id, actor: req.user, reason: req.body.reason, req });
  res.json({ status: 'success', data: { membership: serializeMembership(membership) } });
});

// Restreint aux memberships du sous-arbre tenant de l'acteur, jamais
// n'importe quel userId (fuite d'appartenance cross-tenant sinon).
exports.getUserMemberships = asyncHandler(async (req, res) => {
  const rootId = await actorTenantRootId(req);
  const root = await OrgUnit.findById(rootId).select('path').lean();
  const memberships = await service.getEffectiveMemberships(req.params.userId);
  const scoped = memberships.filter((m) => {
    const unitId = String(m.orgUnit?._id || m.orgUnit);
    return unitId === rootId || m.orgUnit?.path?.startsWith(`${root.path}${rootId}/`);
  });
  res.json({ status: 'success', data: { memberships: scoped } });
});
