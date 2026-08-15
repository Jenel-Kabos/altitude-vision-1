// ======================================================
// 🧩 MIDDLEWARE D'AUTHENTIFICATION ET D'AUTORISATION
// ======================================================
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Property = require('../models/Property');
const logger = require('../utils/logger');

// ======================================================
// 🔒 MIDDLEWARE : AUTHENTIFICATION OBLIGATOIRE
// ======================================================
/**
 * @description Bloque la requête si l'utilisateur n'a pas de token valide.
 * Vérifie le statut du compte et la version du token.
 */
const protect = asyncHandler(async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
    res.status(401);
    throw new Error('Non autorisé : aucun token fourni.');
  }

  const token = req.headers.authorization.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    res.status(401);
    throw new Error('Non autorisé : token invalide ou expiré.');
  }

  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    res.status(401);
    throw new Error('Non autorisé : utilisateur inexistant');
  }

  // Invalidation par tokenVersion (logout global, reset password)
  if (decoded.tokenVersion !== undefined && decoded.tokenVersion < user.tokenVersion) {
    res.status(401);
    throw Object.assign(new Error('Session expirée, veuillez vous reconnecter.'), { name: 'AuthSessionError', code: 'SESSION_REVOKED' });
  }

  // Changement de mot de passe après émission du token
  if (typeof user.changedPasswordAfter === 'function' && user.changedPasswordAfter(decoded.iat)) {
    res.status(401);
    throw Object.assign(new Error('Mot de passe modifié. Veuillez vous reconnecter.'), { name: 'AuthSessionError', code: 'SESSION_REVOKED' });
  }

  // Compte suspendu ou banni — SYNC-2A : `code` structuré ajouté (name
  // `AccountStatusError`) pour que les clients distinguent ce 403
  // ("session mid-vie devenue invalide") d'un 403 d'autorisation ordinaire
  // (ownership/capability) sans jamais se fier au texte du message. Aucun
  // client existant (Web) ne dépendait du message brut : ajout additif, non
  // cassant.
  if (user.status === 'Suspendu' || user.status === 'Banni' || !user.isActive) {
    res.status(403);
    const statusCode = user.status === 'Suspendu' ? 'ACCOUNT_SUSPENDED' : user.status === 'Banni' ? 'ACCOUNT_BANNED' : 'ACCOUNT_INACTIVE';
    throw Object.assign(new Error(`Accès refusé : votre compte est ${(user.status || 'inactif').toLowerCase()}.`), { name: 'AccountStatusError', code: statusCode });
  }

  // Mise à jour de l'activité (non bloquante)
  User.findByIdAndUpdate(user._id, { lastActivityAt: new Date() }).catch(() => {});

  req.user = user;
  next();
});

// ======================================================
// 🧩 AUTHENTIFICATION OPTIONNELLE
// ======================================================
/**
 * @description Vérifie le token s'il existe, mais ne bloque pas la requête sinon.
 * Utile pour les routes publiques qui veulent savoir si un utilisateur est connecté.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select('-password');

      const tokenRevoked = user && decoded.tokenVersion !== undefined && decoded.tokenVersion < user.tokenVersion;
      const passwordChanged = user && typeof user.changedPasswordAfter === 'function' && user.changedPasswordAfter(decoded.iat);
      const accountDisabled = user && (user.status === 'Suspendu' || user.status === 'Banni' || user.status === 'Supprimé' || !user.isActive);

      if (user && !tokenRevoked && !passwordChanged && !accountDisabled) {
        req.user = user;
        logger.success('[OptionalAuth] Utilisateur connecté', { email: user.email });
      } else {
        req.user = null;
        logger.warn('[OptionalAuth] Utilisateur inactif ou introuvable');
      }
    } catch (error) {
      logger.warn('[OptionalAuth] Token invalide ou expiré, continuation sans authentification');
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next(); // Continue toujours
});

// ======================================================
// 🎯 MIDDLEWARE DE RÔLE (ROLE-BASED ACCESS CONTROL)
// ======================================================
/**
 * @description Vérifie que le rôle de l'utilisateur est dans la liste autorisée.
 * Exemple : restrictTo('Admin', 'Collaborateur')
 */
const restrictTo = (...roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) {
    return next();
  }

  res.status(403);
  throw new Error(`Accès refusé. Réservé aux rôles : ${roles.join(', ')}`);
};

/**
 * @description Raccourci spécifique pour un rôle strictement 'Admin'
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    return next();
  }

  res.status(403);
  throw new Error('Accès refusé : rôle administrateur requis.');
};

// ======================================================
// 🏠 CONTRÔLE DE PROPRIÉTÉ (Propriétaire OU Admin)
// ======================================================
/**
 * @description Vérifie que l'utilisateur est soit Admin, soit propriétaire de la propriété.
 * Utilisé pour les routes UPDATE / DELETE de propriétés.
 */
const checkPropertyOwnership = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Non autorisé, authentification requise.');
  }

  const property = await Property.findById(req.params.id);

  if (!property) {
    res.status(404);
    throw new Error('Propriété non trouvée.');
  }

  const isAdmin = req.user.role === 'Admin';
  const isOwner = property.owner.toString() === req.user._id.toString();

  if (isAdmin || isOwner) {
    req.property = property;
    return next();
  }

  res.status(403);
  throw new Error('Accès refusé. Vous devez être le propriétaire ou un administrateur.');
});

// ======================================================
// 🚀 EXPORTS
// ======================================================
module.exports = {
  protect,
  optionalAuth,
  restrictTo,
  adminOnly,
  checkPropertyOwnership,
};
