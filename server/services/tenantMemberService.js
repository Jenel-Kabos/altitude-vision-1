// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1D — API de gestion des MEMBRES.
//
// Règle métier :
//   Un tenant ne crée pas, ne possède pas, ne supprime pas l'identité User
//   globale. Toute mutation cible OrgMembership ; User global reste intact.
//
// Autorités :
//   - Autorité canonique tenant : caller est Admin actif du tenant courant
//     (via `req.tenantBusinessRole === 'Admin'`, vérifié en amont par
//     `requireTenantMembershipRole('Admin')`).
//   - resolveTenantMembership gère la sécurité des lectures.
//   - Les mutations utilisent une session Mongo transactionnelle sur les
//     scenarii sensibles (last-admin) pour éviter les race conditions.

const mongoose = require('mongoose');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');
const { TENANT_BUSINESS_ROLES } = require('../constants/organizationConstants');
const { resolveTenantMembership } = require('./tenantMembershipService');

class TenantMemberError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message); this.name = 'TenantMemberError'; this.code = code; this.statusCode = statusCode;
  }
}
const fail = (code, message, statusCode = 400) => { throw new TenantMemberError(code, message, statusCode); };

const asId = (v) => (v && v._id ? v._id : v);
const isValidId = (id) => id && mongoose.isValidObjectId(id);

async function resolveTenantOrFail(tenantId) {
  if (!isValidId(tenantId)) fail('TENANT_INVALID', 'Tenant invalide.', 400);
  const tenant = await PlatformTenant.findById(tenantId).lean();
  if (!tenant?.rootOrgUnit) fail('TENANT_NOT_FOUND', 'Tenant introuvable.', 404);
  return tenant;
}

function projectMembership(m, user) {
  return {
    membershipId: String(m._id),
    user: user ? { id: String(user._id), name: user.name, email: user.email, avatar: user.photo || null } : null,
    businessRole: m.businessRole || null,
    roleInUnit: m.roleInUnit,
    status: m.status,
    joinedAt: m.grantedAt || m.createdAt || null,
  };
}

async function listMembers(tenantId) {
  const tenant = await resolveTenantOrFail(tenantId);
  const memberships = await OrgMembership.find({ orgUnit: tenant.rootOrgUnit }).lean();
  if (memberships.length === 0) return [];
  const userIds = [...new Set(memberships.map((m) => String(m.user)))];
  const users = await User.find({ _id: { $in: userIds } }).select('_id name email photo').lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));
  return memberships.map((m) => projectMembership(m, userById.get(String(m.user))));
}

async function findGlobalUserByEmail(email) {
  if (!email || typeof email !== 'string') fail('EMAIL_REQUIRED', 'Email requis.', 400);
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) fail('EMAIL_REQUIRED', 'Email requis.', 400);
  const user = await User.findOne({ email: trimmed }).select('_id name email photo').lean();
  if (!user) return null;
  return { id: String(user._id), name: user.name, email: user.email, avatar: user.photo || null };
}

function validateBusinessRole(businessRole) {
  if (!TENANT_BUSINESS_ROLES.includes(businessRole)) {
    fail('INVALID_BUSINESS_ROLE', `businessRole invalide (attendu : ${TENANT_BUSINESS_ROLES.join(', ')}).`, 400);
  }
}

async function addMember({ tenantId, userId, email, businessRole, actor }) {
  const tenant = await resolveTenantOrFail(tenantId);
  validateBusinessRole(businessRole);
  let user = null;
  if (userId) {
    if (!isValidId(userId)) fail('USER_ID_INVALID', 'userId invalide.', 400);
    user = await User.findById(userId).select('_id name email photo').lean();
  } else if (email) {
    user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('_id name email photo').lean();
    if (!user) fail('USER_NOT_FOUND_INVITATION_REQUIRED', 'Utilisateur inconnu — invitation requise.', 404);
  } else {
    fail('USER_REFERENCE_REQUIRED', 'userId ou email requis.', 400);
  }
  if (!user) fail('USER_NOT_FOUND', 'Utilisateur introuvable.', 404);

  // Refuse duplicate active membership on this tenant root.
  const activeExisting = await OrgMembership.find({
    user: user._id, orgUnit: tenant.rootOrgUnit, status: 'active',
  }).lean();
  if (activeExisting.length > 0) fail('MEMBER_ALREADY_ACTIVE', 'Ce membre est déjà actif dans ce tenant.', 409);

  // Try reactivate a suspended/revoked membership (idempotence path — but
  // requires explicit reactivate for suspended, so we treat both here as
  // "must call POST /reactivate first" to avoid hidden side effects).
  const existingInactive = await OrgMembership.findOne({
    user: user._id, orgUnit: tenant.rootOrgUnit, status: { $in: ['suspended', 'revoked'] },
  });
  if (existingInactive) {
    fail('MEMBER_HAS_INACTIVE_MEMBERSHIP', 'Une adhésion inactive existe déjà — utiliser /reactivate.', 409);
  }

  const membership = await OrgMembership.create({
    user: user._id, orgUnit: tenant.rootOrgUnit,
    roleInUnit: 'member', businessRole, status: 'active',
    grantedBy: asId(actor) || null, grantedAt: new Date(),
  });
  return projectMembership(membership.toObject(), user);
}

// Confirme que la membership appartient au tenant courant.
async function loadMembershipInTenant(membershipId, tenant) {
  if (!isValidId(membershipId)) fail('MEMBERSHIP_ID_INVALID', 'Identifiant invalide.', 404);
  const m = await OrgMembership.findById(membershipId);
  if (!m || String(m.orgUnit) !== String(tenant.rootOrgUnit)) fail('MEMBERSHIP_NOT_FOUND', 'Adhésion introuvable.', 404);
  return m;
}

async function countActiveAdmins(tenant, excludeMembershipId = null) {
  const filter = { orgUnit: tenant.rootOrgUnit, status: 'active', businessRole: 'Admin' };
  if (excludeMembershipId) filter._id = { $ne: excludeMembershipId };
  return OrgMembership.countDocuments(filter);
}

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1D.1 — invariant last-admin sûr en
// architecture distribuée.
//
// Le mutex in-memory précédent (`serialiseByTenant`) ne protégeait qu'un
// seul processus Node. Deux instances backend pouvaient toutes deux lire
// "encore 2 Admins" et commettre chacune leur revoke → 0 Admin final.
//
// Solution Mongo-native : chaque transaction sensible acquiert un
// write-lock sur le document PlatformTenant lui-même (via
// `$currentDate: { updatedAt: true }` — mutation triviale mais suffisante
// pour que le storage engine sérialise les transactions). Deux mutations
// concurrentes sur le même tenant conflictent au niveau document ; le
// loser reçoit une TransientTransactionError (WriteConflict) que
// `session.withTransaction()` retry automatiquement — au retry, la
// re-lecture des Admins actifs voit le résultat du winner, et l'invariant
// (`others === 0`) fait échouer la mutation avec `LAST_TENANT_ADMIN`.
//
// Aucun nouveau champ, aucune infrastructure additionnelle (Redis, etc.).
// Portée tenant-scoped : deux tenants distincts ne se bloquent jamais.
async function acquireTenantSentinelLock(tenantId, session) {
  await PlatformTenant.updateOne(
    { _id: tenantId },
    { $currentDate: { updatedAt: true } },
    { session },
  );
}

async function runInTransaction(fn) {
  const conn = mongoose.connection;
  // Replica set requis. En absence (tests unitaires legacy), retomber sans session.
  let session = null;
  try {
    session = await conn.startSession();
  } catch { session = null; }
  if (!session) return fn(null);
  try {
    let result;
    // withTransaction retente automatiquement sur TransientTransactionError
    // (dont WriteConflict). Le loser du conflit revoit l'état à jour et
    // rejette la mutation via l'invariant LAST_TENANT_ADMIN.
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

async function changeRole({ tenantId, membershipId, businessRole, actor }) {
  const tenant = await resolveTenantOrFail(tenantId);
  validateBusinessRole(businessRole);
  return runInTransaction(async (session) => {
    // Sentinelle distribuée : acquiert un write-lock sur le tenant doc.
    // Toute mutation concurrente sensible sur le MÊME tenant conflict et
    // sera retentée par withTransaction ; au retry, la re-lecture voit
    // l'état commité par la première mutation et l'invariant fait échouer
    // la deuxième si elle laisserait 0 Admin actif.
    await acquireTenantSentinelLock(tenant._id, session);
    const m = await OrgMembership.findById(membershipId).session(session);
    if (!m || String(m.orgUnit) !== String(tenant.rootOrgUnit)) fail('MEMBERSHIP_NOT_FOUND', 'Adhésion introuvable.', 404);
    if (m.status !== 'active') fail('MEMBERSHIP_NOT_ACTIVE', 'Adhésion inactive.', 409);
    // Ambiguïté : plusieurs actives sur ce (user, tenant.rootOrgUnit) → fail closed.
    const active = await OrgMembership.find({ user: m.user, orgUnit: tenant.rootOrgUnit, status: 'active' }).session(session);
    if (active.length > 1) fail('AMBIGUOUS_ACTIVE_TENANT_MEMBERSHIP', 'Adhésions multiples actives — mutation refusée.', 409);
    // Last-admin protection : si on rétrograde un Admin, il doit rester ≥ 1.
    if (m.businessRole === 'Admin' && businessRole !== 'Admin') {
      const others = await OrgMembership.countDocuments({
        orgUnit: tenant.rootOrgUnit, status: 'active', businessRole: 'Admin', _id: { $ne: m._id },
      }).session(session);
      if (others === 0) fail('LAST_TENANT_ADMIN', 'Impossible de rétrograder le dernier Admin actif.', 409);
    }
    m.businessRole = businessRole;
    m.grantedBy = asId(actor) || m.grantedBy;
    await m.save({ session });
    return projectMembership(m.toObject());
  });
}

async function suspendMember({ tenantId, membershipId, actor, reason }) {
  const tenant = await resolveTenantOrFail(tenantId);
  return runInTransaction(async (session) => {
    // Sentinelle distribuée : acquiert un write-lock sur le tenant doc.
    // Toute mutation concurrente sensible sur le MÊME tenant conflict et
    // sera retentée par withTransaction ; au retry, la re-lecture voit
    // l'état commité par la première mutation et l'invariant fait échouer
    // la deuxième si elle laisserait 0 Admin actif.
    await acquireTenantSentinelLock(tenant._id, session);
    const m = await OrgMembership.findById(membershipId).session(session);
    if (!m || String(m.orgUnit) !== String(tenant.rootOrgUnit)) fail('MEMBERSHIP_NOT_FOUND', 'Adhésion introuvable.', 404);
    if (m.status !== 'active') fail('MEMBERSHIP_NOT_ACTIVE', 'Adhésion non active.', 409);
    if (m.businessRole === 'Admin') {
      const others = await OrgMembership.countDocuments({
        orgUnit: tenant.rootOrgUnit, status: 'active', businessRole: 'Admin', _id: { $ne: m._id },
      }).session(session);
      if (others === 0) fail('LAST_TENANT_ADMIN', 'Impossible de suspendre le dernier Admin actif.', 409);
    }
    m.status = 'suspended';
    m.suspendedBy = asId(actor) || null;
    m.suspendedAt = new Date();
    m.suspensionReason = reason ? String(reason).slice(0, 1000) : null;
    await m.save({ session });
    return projectMembership(m.toObject());
  });
}

async function reactivateMember({ tenantId, membershipId, actor }) {
  const tenant = await resolveTenantOrFail(tenantId);
  return runInTransaction(async (session) => {
    // Sentinelle distribuée : acquiert un write-lock sur le tenant doc.
    // Toute mutation concurrente sensible sur le MÊME tenant conflict et
    // sera retentée par withTransaction ; au retry, la re-lecture voit
    // l'état commité par la première mutation et l'invariant fait échouer
    // la deuxième si elle laisserait 0 Admin actif.
    await acquireTenantSentinelLock(tenant._id, session);
    const m = await OrgMembership.findById(membershipId).session(session);
    if (!m || String(m.orgUnit) !== String(tenant.rootOrgUnit)) fail('MEMBERSHIP_NOT_FOUND', 'Adhésion introuvable.', 404);
    if (m.status === 'active') fail('MEMBERSHIP_ALREADY_ACTIVE', 'Adhésion déjà active.', 409);
    // Empêche la création d'une deuxième active sur (user, rootOrgUnit).
    const activeCount = await OrgMembership.countDocuments({
      user: m.user, orgUnit: tenant.rootOrgUnit, status: 'active',
    }).session(session);
    if (activeCount > 0) fail('AMBIGUOUS_ACTIVE_TENANT_MEMBERSHIP', 'Une autre adhésion active existe déjà — mutation refusée.', 409);
    m.status = 'active';
    m.suspendedBy = null; m.suspendedAt = null; m.suspensionReason = null;
    m.revokedBy = null; m.revokedAt = null; m.revocationReason = null;
    m.grantedBy = asId(actor) || m.grantedBy;
    m.grantedAt = new Date();
    await m.save({ session });
    return projectMembership(m.toObject());
  });
}

async function revokeMember({ tenantId, membershipId, actor, reason }) {
  const tenant = await resolveTenantOrFail(tenantId);
  return runInTransaction(async (session) => {
    // Sentinelle distribuée : acquiert un write-lock sur le tenant doc.
    // Toute mutation concurrente sensible sur le MÊME tenant conflict et
    // sera retentée par withTransaction ; au retry, la re-lecture voit
    // l'état commité par la première mutation et l'invariant fait échouer
    // la deuxième si elle laisserait 0 Admin actif.
    await acquireTenantSentinelLock(tenant._id, session);
    const m = await OrgMembership.findById(membershipId).session(session);
    if (!m || String(m.orgUnit) !== String(tenant.rootOrgUnit)) fail('MEMBERSHIP_NOT_FOUND', 'Adhésion introuvable.', 404);
    if (m.status === 'revoked') fail('MEMBERSHIP_ALREADY_REVOKED', 'Adhésion déjà révoquée.', 409);
    if (m.status === 'active' && m.businessRole === 'Admin') {
      const others = await OrgMembership.countDocuments({
        orgUnit: tenant.rootOrgUnit, status: 'active', businessRole: 'Admin', _id: { $ne: m._id },
      }).session(session);
      if (others === 0) fail('LAST_TENANT_ADMIN', 'Impossible de retirer le dernier Admin actif.', 409);
    }
    m.status = 'revoked';
    m.revokedBy = asId(actor) || null;
    m.revokedAt = new Date();
    m.revocationReason = reason ? String(reason).slice(0, 1000) : null;
    await m.save({ session });
    return projectMembership(m.toObject());
  });
}

module.exports = {
  TenantMemberError,
  listMembers, findGlobalUserByEmail,
  addMember, changeRole, suspendMember, reactivateMember, revokeMember,
  countActiveAdmins, loadMembershipInTenant,
};
