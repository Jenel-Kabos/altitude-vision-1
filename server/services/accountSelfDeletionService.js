// GOOGLE-PLAY-P0-1 — Suppression de compte self-service.
//
// Réutilise les invariants existants :
//   - `status: 'Supprimé'` (valeur d'enum déjà présente sur User.status)
//   - `tokenVersion` : incrémenté pour révoquer toutes les sessions JWT
//   - `authMiddleware.protect` bloque déjà `isActive: false` et status
//     'Suspendu'/'Banni' → un compte 'Supprimé' + isActive:false ne peut
//     plus s'authentifier
//   - OrgMembership : révocation via patch direct du document (le service
//     tenantMemberService.revokeMember exige un actor Admin du tenant ; ici
//     l'utilisateur agit sur SA propre membership → révocation directe
//     après la même vérification last-admin).
//
// Stratégie : soft-delete + anonymisation.
// Les enregistrements métier (Property, Transaction, Contrat, Invoice,
// Payment, Message, Notification…) restent intacts pour préserver
// l'intégrité comptable, contractuelle et conversationnelle. Ils continuent
// à référencer l'ObjectId User, mais les données personnelles (nom, email,
// téléphone, photo, bio, tokens) sont effacées ou remplacées par des
// valeurs anonymes stables.

const mongoose = require('mongoose');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const OrgUnit = require('../models/OrgUnit');
const { destroyFromCloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');

class AccountSelfDeletionError extends Error {
  constructor(code, message, statusCode = 409, details = null) {
    super(message);
    this.name = 'AccountSelfDeletionError';
    this.code = code;
    this.statusCode = statusCode;
    if (details) this.details = details;
  }
}

function fail(code, message, statusCode = 409, details = null) {
  throw new AccountSelfDeletionError(code, message, statusCode, details);
}

// Anonymisation : email unique et stable, ne collisionne pas avec un vrai
// email (domaine réservé `.deleted.altitudevision.local`).
function buildAnonymousProfile(userId) {
  const suffix = String(userId);
  return {
    name: 'Utilisateur supprimé',
    email: `deleted-${suffix}@deleted.altitudevision.local`,
    phone: null,
    photo: null,
    bio: null,
    pushToken: null,
    googleId: undefined,
    avatar: null,
    emailVerificationToken: undefined,
    emailVerificationExpires: undefined,
    passwordResetToken: undefined,
    passwordResetExpires: undefined,
    contratPdfUrl: undefined,
    contratPdfAsset: undefined,
    isActive: false,
    status: 'Supprimé',
    isEmailVerified: false,
  };
}

async function findBlockingLastAdminTenants(userId, session) {
  const activeAdminMemberships = await OrgMembership.find({
    user: userId,
    status: 'active',
    businessRole: 'Admin',
  }).session(session).lean();

  const blocking = [];
  for (const m of activeAdminMemberships) {
    const others = await OrgMembership.countDocuments({
      orgUnit: m.orgUnit,
      status: 'active',
      businessRole: 'Admin',
      _id: { $ne: m._id },
    }).session(session);
    if (others === 0) {
      blocking.push({ membershipId: String(m._id), orgUnit: String(m.orgUnit) });
    }
  }
  return blocking;
}

async function revokeAllActiveMemberships(userId, session, reason) {
  const memberships = await OrgMembership.find({
    user: userId,
    status: { $ne: 'revoked' },
  }).session(session);

  for (const m of memberships) {
    m.status = 'revoked';
    m.revokedAt = new Date();
    m.revokedBy = new mongoose.Types.ObjectId(String(userId));
    m.revocationReason = reason.slice(0, 1000);
    await m.save({ session });
  }
  return memberships.length;
}

async function runInTransaction(fn) {
  const conn = mongoose.connection;
  let session = null;
  try {
    session = await conn.startSession();
  } catch { session = null; }
  if (!session) return fn(null);
  try {
    let result;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

// Point d'entrée : suppression self-service.
// `authenticatedUserId` doit provenir EXCLUSIVEMENT de req.user (JWT
// vérifié par authMiddleware.protect). Le controller ne doit JAMAIS
// accepter un userId du body/params.
async function deleteMyAccount({ authenticatedUserId, reason = 'account_self_deletion' }) {
  if (!authenticatedUserId) {
    fail('UNAUTHENTICATED', 'Authentification requise.', 401);
  }
  const userId = String(authenticatedUserId);
  if (!mongoose.isValidObjectId(userId)) {
    fail('INVALID_USER_ID', 'Identifiant utilisateur invalide.', 400);
  }

  return runInTransaction(async (session) => {
    const query = User.findById(userId).select('+password +contratPdfUrl');
    const user = session ? await query.session(session) : await query;
    if (!user) {
      fail('USER_NOT_FOUND', 'Utilisateur introuvable.', 404);
    }
    if (user.status === 'Supprimé') {
      // Idempotence : suppression déjà effectuée.
      return {
        alreadyDeleted: true,
        userId: String(user._id),
        revokedMembershipsCount: 0,
      };
    }

    // Invariant last-admin : bloque la suppression si l'utilisateur est
    // seul Admin actif d'au moins un tenant. Voir la constante d'erreur
    // documentée dans docs/compliance/google-play-privacy-audit.md.
    const blocking = await findBlockingLastAdminTenants(userId, session);
    if (blocking.length > 0) {
      fail(
        'LAST_TENANT_ADMIN_ACCOUNT_DELETION_BLOCKED',
        `Suppression bloquée : vous êtes seul administrateur actif de ${blocking.length} organisation(s). Transférez l'administration avant de supprimer votre compte.`,
        409,
        { blockingTenants: blocking },
      );
    }

    // Cloudinary : détruit uniquement l'avatar personnel. Les photos de
    // biens/documents restent liées à leurs enregistrements métier.
    const previousPhoto = user.photo;

    const anonymized = buildAnonymousProfile(userId);
    Object.assign(user, anonymized);
    // Invalide toutes les sessions JWT existantes.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.passwordChangedAt = new Date();
    // Mot de passe rendu inutilisable : bcrypt hash d'une valeur aléatoire.
    // Le middleware pre-save re-hash automatiquement (voir User.js).
    user.password = require('crypto').randomBytes(48).toString('hex');
    user.passwordConfirm = user.password;
    await user.save({ session, validateBeforeSave: false });

    const revokedCount = await revokeAllActiveMemberships(userId, session, reason);

    // Destruction Cloudinary hors transaction (best effort).
    setImmediate(() => {
      destroyFromCloudinary(previousPhoto).catch((err) => {
        logger.warn?.('accountSelfDeletion: Cloudinary destroy failed', err?.message);
      });
    });

    return {
      alreadyDeleted: false,
      userId,
      revokedMembershipsCount: revokedCount,
    };
  });
}

module.exports = {
  AccountSelfDeletionError,
  deleteMyAccount,
  // Exposé pour les tests uniquement.
  _internals: { buildAnonymousProfile, findBlockingLastAdminTenants },
};
