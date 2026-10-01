// PLATFORM-ADMIN-1 — Service central de gestion de l'identité
// PlatformOperator. Même patron d'audit que platformTenantService.js
// (grantedBy/At/Reason, suspendedBy/At/Reason, revokedBy/At/Reason + entrée
// ActionLog systématique par transition).
//
// PRINCIPE DE SÉCURITÉ (mission §44-46) : aucune fonction ici ne doit
// jamais être appelable sans qu'un `actor` explicite, lui-même vérifié en
// amont (route) comme un opérateur actif détenant `platform.operators.manage`,
// ne soit fourni. Ce fichier ne fait AUCUNE vérification d'autorisation —
// c'est le rôle de `platformOperatorController.js`/`platformOperatorRoutes.js`.
// Le séparer ainsi évite qu'une future route oublie la garde en réutilisant
// le service : la garde vit dans un seul routeur, jamais dupliquée.
const PlatformOperator = require('../../models/PlatformOperator');
const PlatformAuthorityLock = require('../../models/PlatformAuthorityLock');
const User = require('../../models/User');
const mongoose = require('mongoose');
const { PLATFORM_OPERATOR_CAPABILITIES, PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../../constants/platformOperatorConstants');
const { logAction, buildAuteur } = require('../actionLogService');

class PlatformOperatorError extends Error {
  constructor(code, message, statusCode = 400) { super(message); this.name = 'PlatformOperatorError'; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, message, statusCode) => { throw new PlatformOperatorError(code, message, statusCode); };
const VIABILITY_CAPABILITY = 'platform.operators.manage';

async function runInAuthorityTransaction(fn) {
  let session = null;
  try { session = await mongoose.connection.startSession(); } catch { session = null; }
  if (!session) return fn(null);
  try {
    let result;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

async function acquireAuthoritySentinelLock(session) {
  const options = { upsert: true, new: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) };
  await PlatformAuthorityLock.findOneAndUpdate(
    { _id: 'platform-authority' },
    { $inc: { revision: 1 } },
    options,
  );
}

async function countViableOperators({ excludeUserId = null, session = null } = {}) {
  const operatorQuery = PlatformOperator.find({
    status: 'active',
    capabilities: VIABILITY_CAPABILITY,
    ...(excludeUserId ? { user: { $ne: excludeUserId } } : {}),
  }).select('user');
  if (session) operatorQuery.session(session);
  const operators = await operatorQuery.lean();
  if (!operators.length) return 0;
  const userQuery = User.countDocuments({
    _id: { $in: operators.map((operator) => operator.user) },
    isActive: true,
    status: { $nin: ['Suspendu', 'Banni', 'Supprimé'] },
  });
  if (session) userQuery.session(session);
  return userQuery;
}

async function assertCanRemoveViableOperator(userId, session) {
  const operatorQuery = PlatformOperator.findOne({ user: userId });
  if (session) operatorQuery.session(session);
  const operator = await operatorQuery.lean();
  if (!operator || operator.status !== 'active' || !operator.capabilities?.includes(VIABILITY_CAPABILITY)) return;

  const userQuery = User.findById(userId).select('_id isActive status');
  if (session) userQuery.session(session);
  const user = await userQuery.lean();
  const currentlyViable = user && user.isActive && !['Suspendu', 'Banni', 'Supprimé'].includes(user.status);
  if (!currentlyViable) return;

  const others = await countViableOperators({ excludeUserId: userId, session });
  if (others === 0) {
    fail('LAST_PLATFORM_OPERATOR', 'Impossible de désactiver le dernier opérateur plateforme viable.', 409);
  }
}

async function guardUserViabilityMutation({ userId, operation }) {
  return runInAuthorityTransaction(async (session) => {
    await acquireAuthoritySentinelLock(session);
    await assertCanRemoveViableOperator(userId, session);
    return operation(session);
  });
}

async function assertNoPlatformOperatorForHardDelete(userId, session = null) {
  const query = PlatformOperator.exists({ user: userId });
  if (session) query.session(session);
  if (await query) {
    fail(
      'PLATFORM_OPERATOR_HARD_DELETE_REQUIRES_HUMAN_DECISION',
      "Suppression physique refusée : l'identité possède un historique PlatformOperator à préserver.",
      409,
    );
  }
}

async function transitionOperatorForUserLifecycle({ userId, status, actor, reason, session = null }) {
  if (!['suspended', 'revoked'].includes(status)) {
    fail('PLATFORM_OPERATOR_INVALID_STATUS', 'Transition opérateur invalide.', 422);
  }
  const query = PlatformOperator.findOne({ user: userId });
  if (session) query.session(session);
  const operator = await query;
  if (!operator || operator.status === 'revoked') return null;
  const now = new Date();
  if (status === 'suspended') {
    operator.status = 'suspended';
    operator.suspendedBy = actor?._id || actor?.id || userId;
    operator.suspendedAt = now;
    operator.suspensionReason = reason;
  } else {
    operator.status = 'revoked';
    operator.revokedBy = actor?._id || actor?.id || userId;
    operator.revokedAt = now;
    operator.revokeReason = reason;
  }
  await operator.save({ session });
  return operator.toObject();
}

async function audit(event, { actor, targetUserId, reason, before, after, req }) {
  await logAction({
    action: `platform_operator.${event}`,
    description: `PlatformOperator ${targetUserId} — ${event}${reason ? ` (${reason})` : ''}`,
    module: 'PlatformAdmin',
    scopeMode: 'platform',
    typeAction: event === 'revoked' ? 'SUPPRESSION' : event === 'granted' ? 'CRÉATION' : 'MODIFICATION',
    auteur: buildAuteur(actor),
    cible: { id: String(targetUserId), type: 'PlatformOperator', nom: String(targetUserId) },
    metadata: {
      ancienneValeur: before ? JSON.stringify(before) : undefined,
      nouvelleValeur: after ? JSON.stringify(after) : undefined,
      reason,
    },
    req,
  }).catch(() => {});
}

function validateCapabilities(capabilities = []) {
  const invalid = capabilities.filter((cap) => !PLATFORM_OPERATOR_CAPABILITIES.includes(cap));
  if (invalid.length) fail('PLATFORM_OPERATOR_INVALID_CAPABILITY', `Capacité(s) inconnue(s) : ${invalid.join(', ')}`, 422);
}

// Lecture pure, jamais de garde ici (voir en-tête de fichier).
async function getOperatorByUserId(userId) {
  if (!userId) return null;
  return PlatformOperator.findOne({ user: userId }).lean();
}

// Résolution utilisée par tenantContextService — uniquement les opérateurs
// réellement ACTIFS comptent pour l'autorisation. Suspendu/révoqué = aucune
// capacité, aussi silencieusement qu'un utilisateur qui n'a jamais été
// opérateur (fail-closed par défaut).
async function resolveActiveOperator(userId) {
  if (!userId) return null;
  const operator = await PlatformOperator.findOne({ user: userId, status: 'active' }).lean();
  return operator || null;
}

function hasCapability(operator, capability) {
  return Boolean(operator && operator.status === 'active' && operator.capabilities?.includes(capability));
}

// PLATFORM-ADMIN-04A — droit d'ENTRER dans la Vue plateforme (scope global),
// distinct du droit d'agir (`hasCapability`). Vrai uniquement pour un
// opérateur actif détenant toutes les PLATFORM_VIEW_REQUIRED_CAPABILITIES.
// Ne lit jamais User.role : un Admin historique n'est pas un opérateur.
function isPlatformViewEligible(operator) {
  if (!operator || operator.status !== 'active' || !Array.isArray(operator.capabilities)) return false;
  const granted = new Set(operator.capabilities);
  return PLATFORM_VIEW_REQUIRED_CAPABILITIES.every((capability) => granted.has(capability));
}

// GRANT — ne fait JAMAIS de promotion automatique : `actor` et `reason` sont
// obligatoires, l'utilisateur cible doit exister et ne pas être `isTechnical`
// (jamais un compte technique GL-ARCH-1.1). Idempotent : si un document
// révoqué/suspendu existe déjà pour cet utilisateur, il est réactivé (jamais
// dupliqué) — mais UNIQUEMENT via cet appel explicite, jamais implicitement.
async function grantOperator({ userId, capabilities = [], actor, reason, req, allowSelfGrant = false }) {
  if (!actor) fail('PLATFORM_OPERATOR_ACTOR_REQUIRED', 'Un acteur authentifié est requis.', 401);
  if (!userId) fail('PLATFORM_OPERATOR_USER_REQUIRED', 'Utilisateur cible requis.', 422);
  if (!reason || !reason.trim()) fail('PLATFORM_OPERATOR_REASON_REQUIRED', 'Un motif est requis.', 422);
  // Mission §12/§44 : jamais d'auto-promotion, y compris par un opérateur
  // déjà actif qui s'accorderait de nouvelles capacités à lui-même — la
  // séparation des responsabilités exige un second opérateur distinct.
  //
  // PLATFORM-ADMIN-BOOTSTRAP-EXEC-1 — `allowSelfGrant` : jamais exposé par
  // la route HTTP (`platformOperatorController.js` ne le passe jamais,
  // toujours `false` par défaut là), réservé exclusivement au script CLI
  // `bootstrapPlatformOperator.js --allow-self-grant`, et même alors ne
  // fonctionne QUE si AUCUN PlatformOperator n'existe encore nulle part
  // (`PlatformOperator.exists({})`) — jamais une échappatoire générale, se
  // referme d'elle-même dès le premier octroi réussi puisqu'un document
  // existe alors forcément.
  if (String(userId) === String(actor._id || actor.id)) {
    if (!allowSelfGrant) fail('PLATFORM_OPERATOR_SELF_ACTION_FORBIDDEN', 'Un opérateur ne peut pas modifier ses propres capacités.', 403);
    const anyOperatorExists = await PlatformOperator.exists({});
    if (anyOperatorExists) fail('PLATFORM_OPERATOR_SELF_GRANT_ONLY_FOR_FIRST_BOOTSTRAP', 'Le self-grant explicite n\'est autorisé que pour le tout premier bootstrap, lorsqu\'aucun PlatformOperator n\'existe encore sur cette base.', 403);
  }
  validateCapabilities(capabilities);

  const targetUser = await User.findOne({ _id: userId, isTechnical: { $ne: true } }).select('_id isActive status');
  if (!targetUser) fail('PLATFORM_OPERATOR_USER_NOT_FOUND', 'Utilisateur cible introuvable.', 404);

  let before;
  let saved;
  try {
    saved = await runInAuthorityTransaction(async (session) => {
      await acquireAuthoritySentinelLock(session);
      const existingQuery = PlatformOperator.findOne({ user: userId });
      if (session) existingQuery.session(session);
      const existing = await existingQuery;
      before = existing ? { status: existing.status, capabilities: existing.capabilities } : null;
      const removesViability = existing?.status === 'active'
        && existing.capabilities?.includes(VIABILITY_CAPABILITY)
        && !capabilities.includes(VIABILITY_CAPABILITY);
      if (removesViability) await assertCanRemoveViableOperator(userId, session);

      const doc = existing || new PlatformOperator({ user: userId });
      doc.status = 'active';
      doc.capabilities = [...new Set(capabilities)];
      doc.grantedBy = actor._id || actor.id;
      doc.grantedAt = new Date();
      doc.grantReason = reason.trim();
      doc.suspendedBy = null;
      doc.suspendedAt = null;
      doc.suspensionReason = null;
      doc.revokedBy = null;
      doc.revokedAt = null;
      doc.revokeReason = null;
      await doc.save({ session });
      return doc.toObject();
    });
  } catch (error) {
    // PLATFORM-ADMIN-BOOTSTRAP-1 — sous concurrence, deux appels simultanés
    // pour un MÊME utilisateur sans document préexistant peuvent tous deux
    // lire `existing = null` avant que l'un des deux n'insère. La contrainte
    // `unique: true` (models/PlatformOperator.js) garantit qu'un seul insert
    // réussit jamais — le perdant de la course ne doit jamais planter avec
    // une erreur Mongo brute ni, surtout, jamais réessayer silencieusement
    // une mutation qui créerait une incohérence : il doit simplement signaler
    // clairement que l'opération a déjà été prise en charge ailleurs.
    if (error?.code === 11000) {
      fail('PLATFORM_OPERATOR_CONCURRENT_GRANT', 'Un octroi concurrent pour cet utilisateur vient d\'aboutir ailleurs ; relancez l\'opération pour observer l\'état final.', 409);
    }
    throw error;
  }

  await audit('granted', { actor, targetUserId: userId, reason, before, after: { status: saved.status, capabilities: saved.capabilities }, req });
  return saved;
}

// SUSPEND — réversible (reactivateOperator), pour un besoin temporaire
// (ex. congé, investigation) sans perdre l'historique de capacités.
async function suspendOperator({ userId, actor, reason, req }) {
  if (!actor) fail('PLATFORM_OPERATOR_ACTOR_REQUIRED', 'Un acteur authentifié est requis.', 401);
  if (!reason || !reason.trim()) fail('PLATFORM_OPERATOR_REASON_REQUIRED', 'Un motif est requis.', 422);
  let before;
  const saved = await runInAuthorityTransaction(async (session) => {
    await acquireAuthoritySentinelLock(session);
    const query = PlatformOperator.findOne({ user: userId });
    if (session) query.session(session);
    const doc = await query;
    if (!doc) fail('PLATFORM_OPERATOR_NOT_FOUND', 'Aucun opérateur trouvé pour cet utilisateur.', 404);
    if (doc.status === 'revoked') fail('PLATFORM_OPERATOR_REVOKED', 'Cet opérateur a été révoqué ; une nouvelle attribution est requise.', 409);
    if (String(doc.user) === String(actor._id || actor.id)) fail('PLATFORM_OPERATOR_SELF_ACTION_FORBIDDEN', 'Un opérateur ne peut pas suspendre sa propre capacité.', 403);
    await assertCanRemoveViableOperator(userId, session);
    before = { status: doc.status };
    doc.status = 'suspended';
    doc.suspendedBy = actor._id || actor.id;
    doc.suspendedAt = new Date();
    doc.suspensionReason = reason.trim();
    await doc.save({ session });
    return doc.toObject();
  });

  await audit('suspended', { actor, targetUserId: userId, reason, before, after: { status: saved.status }, req });
  return saved;
}

async function reactivateOperator({ userId, actor, reason, req }) {
  if (!actor) fail('PLATFORM_OPERATOR_ACTOR_REQUIRED', 'Un acteur authentifié est requis.', 401);
  if (!reason || !reason.trim()) fail('PLATFORM_OPERATOR_REASON_REQUIRED', 'Un motif est requis.', 422);
  const doc = await PlatformOperator.findOne({ user: userId });
  if (!doc) fail('PLATFORM_OPERATOR_NOT_FOUND', 'Aucun opérateur trouvé pour cet utilisateur.', 404);
  if (doc.status === 'revoked') fail('PLATFORM_OPERATOR_REVOKED', 'Cet opérateur a été révoqué ; une nouvelle attribution est requise.', 409);

  const before = { status: doc.status };
  doc.status = 'active';
  doc.suspendedBy = null;
  doc.suspendedAt = null;
  doc.suspensionReason = null;
  await doc.save();

  await audit('reactivated', { actor, targetUserId: userId, reason, before, after: { status: doc.status }, req });
  return doc.toObject();
}

// REVOKE — jamais de suppression physique (mission §9 : historique
// traçable). Un opérateur révoqué ne peut être réactivé : `grantOperator`
// doit être rappelé explicitement (nouvelle décision, nouveau motif,
// nouvel horodatage `grantedAt`), jamais une simple bascule de statut.
async function revokeOperator({ userId, actor, reason, req }) {
  if (!actor) fail('PLATFORM_OPERATOR_ACTOR_REQUIRED', 'Un acteur authentifié est requis.', 401);
  if (!reason || !reason.trim()) fail('PLATFORM_OPERATOR_REASON_REQUIRED', 'Un motif est requis.', 422);
  let before;
  const saved = await runInAuthorityTransaction(async (session) => {
    await acquireAuthoritySentinelLock(session);
    const query = PlatformOperator.findOne({ user: userId });
    if (session) query.session(session);
    const doc = await query;
    if (!doc) fail('PLATFORM_OPERATOR_NOT_FOUND', 'Aucun opérateur trouvé pour cet utilisateur.', 404);
    if (String(doc.user) === String(actor._id || actor.id)) fail('PLATFORM_OPERATOR_SELF_ACTION_FORBIDDEN', 'Un opérateur ne peut pas révoquer sa propre capacité.', 403);
    await assertCanRemoveViableOperator(userId, session);
    before = { status: doc.status };
    doc.status = 'revoked';
    doc.revokedBy = actor._id || actor.id;
    doc.revokedAt = new Date();
    doc.revokeReason = reason.trim();
    await doc.save({ session });
    return doc.toObject();
  });

  await audit('revoked', { actor, targetUserId: userId, reason, before, after: { status: saved.status }, req });
  return saved;
}

async function listOperators() {
  return PlatformOperator.find().sort({ createdAt: -1 }).populate('user', 'name email role').lean();
}

// Résolveur canonique unique pour "tous les opérateurs actifs détenant X" —
// jamais un PlatformOperator.find(...) répété dans chaque service métier qui
// a besoin de notifier/lister des opérateurs par capacité (mission §44-46 :
// une seule interprétation de "opérateur éligible" dans tout le dépôt).
// `unique: true` sur `PlatformOperator.user` (models/PlatformOperator.js)
// garantit déjà l'absence de doublon utilisateur, aucune déduplication
// manuelle n'est donc nécessaire ici. Tri déterministe sur `_id`.
async function resolveActiveOperatorsByCapability(capability) {
  if (!PLATFORM_OPERATOR_CAPABILITIES.includes(capability)) {
    fail('PLATFORM_OPERATOR_INVALID_CAPABILITY', `Capacité inconnue : "${capability}".`, 422);
  }
  return PlatformOperator.find({ status: 'active', capabilities: capability }).sort({ _id: 1 }).select('user').lean();
}

module.exports = {
  PlatformOperatorError,
  getOperatorByUserId,
  resolveActiveOperator,
  hasCapability,
  isPlatformViewEligible,
  resolveActiveOperatorsByCapability,
  grantOperator,
  suspendOperator,
  reactivateOperator,
  revokeOperator,
  listOperators,
  countViableOperators,
  assertCanRemoveViableOperator,
  acquireAuthoritySentinelLock,
  guardUserViabilityMutation,
  assertNoPlatformOperatorForHardDelete,
  transitionOperatorForUserLifecycle,
};
