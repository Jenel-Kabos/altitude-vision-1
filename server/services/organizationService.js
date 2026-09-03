// ORGANIZATION-1 — Service central de la couche organisationnelle. Vient
// AU-DESSUS de User/UserBusinessProfile/HotelStaffAssignment/Property.owner/
// Hotel.manager/CRM — ne les remplace jamais, ne recalcule aucune de leurs
// données. Toute résolution de "qui peut agir sur quoi" au niveau d'un objet
// métier précis reste entièrement gérée par les services existants
// (hotelAccessScopeService, financialAuthorizationService, etc.) : ce
// service répond uniquement à "qui appartient à quelle unité
// organisationnelle", une question orthogonale.
const mongoose = require('mongoose');
const OrgUnit = require('../models/OrgUnit');
const OrgMembership = require('../models/OrgMembership');
const User = require('../models/User');
const { ORG_UNIT_TYPES } = require('../constants/organizationConstants');
const { logAction, buildAuteur } = require('./actionLogService');

class OrganizationError extends Error {
  constructor(code, message, statusCode = 400) { super(message); this.name = 'OrganizationError'; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, message, statusCode) => { throw new OrganizationError(code, message, statusCode); };

async function audit(event, { actor, target, targetType, reason, req, session }) {
  const write = logAction({
    action: `organization.${event}`,
    description: reason || `${targetType} ${target._id} — ${event}`,
    module: 'Organisation',
    typeAction: event.includes('revoked') || event.includes('archived') ? 'SUPPRESSION' : event.includes('created') || event.includes('granted') ? 'CRÉATION' : 'MODIFICATION',
    auteur: buildAuteur(actor),
    cible: { id: String(target._id), type: targetType, nom: target.name || `${target.user}` },
    req, session,
  });
  if (session) await write;
  else await write.catch(() => {});
}

// ── Unités organisationnelles ──────────────────────────────────────────

async function createOrgUnit({ name, type, parentId, linkedEstablishment, actor, req, session } = {}) {
  if (!ORG_UNIT_TYPES.includes(type)) fail('ORG_UNIT_TYPE_INVALID', `Type d'unité inconnu : ${type}.`, 422);
  if (!name || !name.trim()) fail('ORG_UNIT_NAME_REQUIRED', 'Le nom est requis.', 422);

  let parent = null;
  if (type === 'organization') {
    if (parentId) fail('ORG_UNIT_ROOT_CANNOT_HAVE_PARENT', 'Une organisation racine ne peut avoir de parent.', 422);
  } else {
    if (!parentId || !mongoose.isValidObjectId(parentId)) fail('ORG_UNIT_PARENT_REQUIRED', 'Un parent est requis pour toute unité non-racine.', 422);
    parent = await OrgUnit.findById(parentId).session(session || null);
    if (!parent) fail('ORG_UNIT_PARENT_NOT_FOUND', 'Unité parente introuvable.', 404);
    if (parent.status !== 'active') fail('ORG_UNIT_PARENT_ARCHIVED', 'Impossible de rattacher une unité à un parent archivé.', 422);
  }

  const ancestors = parent ? [...parent.ancestors, parent._id] : [];
  const path = parent ? `${parent.path}${parent._id}/` : '/';

  const data = {
    name: name.trim(), type, parent: parent?._id || null, ancestors, path,
    linkedEstablishment: linkedEstablishment || undefined,
    createdBy: actor?._id || actor?.id || null,
  };
  const orgUnit = session ? (await OrgUnit.create([data], { session }))[0] : await OrgUnit.create(data);
  await audit('created', { actor, target: orgUnit, targetType: 'OrgUnit', req, session });
  return orgUnit;
}

async function archiveOrgUnit(id, { actor, reason, req } = {}) {
  const orgUnit = await OrgUnit.findById(id);
  if (!orgUnit) fail('ORG_UNIT_NOT_FOUND', 'Unité introuvable.', 404);
  // Jamais de suppression physique — jamais d'archivage silencieux d'un
  // sous-arbre entier non plus : on refuse tant que des enfants actifs existent.
  const activeChildren = await OrgUnit.countDocuments({ parent: orgUnit._id, status: 'active' });
  if (activeChildren > 0) fail('ORG_UNIT_HAS_ACTIVE_CHILDREN', 'Archivez ou déplacez d’abord les unités enfants actives.', 409);
  orgUnit.status = 'archived';
  await orgUnit.save();
  await audit('archived', { actor, target: orgUnit, targetType: 'OrgUnit', reason, req });
  return orgUnit;
}

// Arbre complet sous `rootId` (racine incluse) en DEUX requêtes maximum
// (l'unité + ses descendants via préfixe de `path`) — jamais une récursion
// applicative unité par unité.
async function getOrgTree(rootId) {
  if (!mongoose.isValidObjectId(rootId)) fail('ORG_UNIT_ID_INVALID', 'Identifiant invalide.', 400);
  const root = await OrgUnit.findById(rootId).lean();
  if (!root) fail('ORG_UNIT_NOT_FOUND', 'Unité introuvable.', 404);
  const descendants = await OrgUnit.find({ path: { $regex: `^${root.path}${root._id}/` } }).lean();
  const byParent = new Map();
  [...descendants].forEach((node) => {
    const key = String(node.parent);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  });
  const attach = (node) => ({ ...node, children: (byParent.get(String(node._id)) || []).map(attach) });
  return attach(root);
}

async function listOrgUnits({ type, status = 'active' } = {}) {
  const filter = { status };
  if (type) filter.type = type;
  return OrgUnit.find(filter).sort({ path: 1, name: 1 }).lean();
}

// ── Appartenances (Phase 5 — multi-organisation/équipe/département) ────

async function grantMembership({ userId, orgUnitId, roleInUnit = 'member', actor, metadata = {}, req, session } = {}) {
  if (!mongoose.isValidObjectId(userId)) fail('ORG_MEMBERSHIP_USER_INVALID', 'Identifiant utilisateur invalide.', 400);
  const [user, orgUnit] = await Promise.all([
    User.findById(userId).select('_id').session(session || null),
    OrgUnit.findById(orgUnitId).session(session || null),
  ]);
  if (!user) fail('ORG_MEMBERSHIP_USER_NOT_FOUND', 'Utilisateur introuvable.', 404);
  if (!orgUnit) fail('ORG_MEMBERSHIP_UNIT_NOT_FOUND', 'Unité organisationnelle introuvable.', 404);

  const existing = await OrgMembership.findOne({ user: userId, orgUnit: orgUnitId, roleInUnit }).session(session || null);
  if (existing) {
    if (existing.status === 'active') return existing;
    existing.status = 'active';
    existing.suspendedBy = null; existing.suspendedAt = null; existing.suspensionReason = null;
    existing.revokedBy = null; existing.revokedAt = null; existing.revocationReason = null;
    existing.grantedBy = actor?._id || actor?.id || null;
    existing.grantedAt = new Date();
    await existing.save({ session });
    await audit('membership_reactivated', { actor, target: existing, targetType: 'OrgMembership', req, session });
    return existing;
  }

  const data = { user: userId, orgUnit: orgUnitId, roleInUnit, metadata, grantedBy: actor?._id || actor?.id || null };
  const membership = session ? (await OrgMembership.create([data], { session }))[0] : await OrgMembership.create(data);
  await audit('membership_granted', { actor, target: membership, targetType: 'OrgMembership', req, session });
  return membership;
}

async function suspendMembership({ membershipId, actor, reason, req } = {}) {
  const membership = await OrgMembership.findOne({ _id: membershipId, status: 'active' });
  if (!membership) fail('ORG_MEMBERSHIP_NOT_ACTIVE', 'Aucune appartenance active avec cet identifiant.', 404);
  membership.status = 'suspended';
  membership.suspendedBy = actor?._id || actor?.id || null;
  membership.suspendedAt = new Date();
  membership.suspensionReason = reason || null;
  await membership.save();
  await audit('membership_suspended', { actor, target: membership, targetType: 'OrgMembership', reason, req });
  return membership;
}

async function revokeMembership({ membershipId, actor, reason, req } = {}) {
  const membership = await OrgMembership.findOne({ _id: membershipId, status: { $in: ['active', 'suspended'] } });
  if (!membership) fail('ORG_MEMBERSHIP_NOT_FOUND', 'Aucune appartenance active ou suspendue avec cet identifiant.', 404);
  membership.status = 'revoked';
  membership.revokedBy = actor?._id || actor?.id || null;
  membership.revokedAt = new Date();
  membership.revocationReason = reason || null;
  await membership.save();
  await audit('membership_revoked', { actor, target: membership, targetType: 'OrgMembership', reason, req });
  return membership;
}

// Toutes les appartenances actives d'un utilisateur (plusieurs
// organisations/équipes/départements simultanément — Phase 5), jamais en
// conflit avec getEffectiveProfiles() de USER-ARCH-1 : deux dimensions
// orthogonales (profil métier vs. rattachement organisationnel).
async function getEffectiveMemberships(userId) {
  return OrgMembership.find({ user: userId, status: 'active' }).populate('orgUnit', 'name type path').lean();
}

// Résout, en requêtes bornées (jamais une par utilisateur), l'ensemble des
// identifiants utilisateurs membres actifs de `orgUnitId` ET, si demandé,
// de tous ses descendants (préfixe de `path`, même technique que getOrgTree)
// — bloc de base réutilisé par Phase 6 (scope) et Phase 9 (filtre Reporting).
async function getScopeUserIds(orgUnitId, { includeDescendants = true } = {}) {
  if (!mongoose.isValidObjectId(orgUnitId)) fail('ORG_UNIT_ID_INVALID', 'Identifiant invalide.', 400);
  const root = await OrgUnit.findById(orgUnitId).select('path').lean();
  if (!root) fail('ORG_UNIT_NOT_FOUND', 'Unité introuvable.', 404);
  let unitIds = [orgUnitId];
  if (includeDescendants) {
    const descendants = await OrgUnit.find({ path: { $regex: `^${root.path}${orgUnitId}/` } }).select('_id').lean();
    unitIds = [...unitIds, ...descendants.map((d) => String(d._id))];
  }
  const userIds = await OrgMembership.find({ orgUnit: { $in: unitIds }, status: 'active' }).distinct('user');
  return new Set(userIds.map(String));
}

module.exports = {
  OrganizationError,
  createOrgUnit, archiveOrgUnit, getOrgTree, listOrgUnits,
  grantMembership, suspendMembership, revokeMembership,
  getEffectiveMemberships, getScopeUserIds,
};
