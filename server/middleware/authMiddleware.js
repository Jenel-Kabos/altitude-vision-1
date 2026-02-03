// ======================================================
// 🧩 MIDDLEWARE D’AUTHENTIFICATION ET D’AUTORISATION
// ======================================================
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Property = require('../models/Property');

// ======================================================
// 🔒 MIDDLEWARE : AUTHENTIFICATION OBLIGATOIRE
// ======================================================
/**
 * @description Bloque la requête si l’utilisateur n’a pas de token valide.
 * Vérifie le statut du compte et la version du token.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Vérifie la présence et le format du header d'autorisation
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Décoder et vérifier le token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Récupérer l’utilisateur depuis la BD
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        console.error('❌ [Auth] Utilisateur non trouvé (token valide)');
        res.status(401);
        throw new Error('Non autorisé : utilisateur inexistant');
      }

      // Vérifie la version du token (token invalidé ?)
      if (decoded.tokenVersion !== undefined && decoded.tokenVersion < user.tokenVersion) {
        console.warn('⚠️ [Auth] Token expiré suite à une réinitialisation de session.');
        res.status(401);
        throw new Error('Session expirée, veuillez vous reconnecter.');
      }

      // Vérifie le statut du compte
      if (user.status === 'Suspendu' || user.status === 'Banni' || !user.isActive) {
        console.warn(`🚫 [Auth] Compte inactif ou ${user.status}`);
        res.status(403);
        throw new Error(`Accès refusé : votre compte est ${user.status.toLowerCase()}.`);
      }

      // Injection de l’utilisateur dans la requête
      req.user = user;
      next();
    } catch (error) {
      console.error('❌ [Auth] Erreur de vérification du token:', error.message);
      res.status(401);
      throw new Error('Non autorisé : token invalide ou expiré.');
    }
  } else {
    res.status(401);
    throw new Error('Non autorisé : aucun token fourni.');
  }
});

// ======================================================
// 🧩 AUTHENTIFICATION OPTIONNELLE
// ======================================================
/**
 * @description Vérifie le token s’il existe, mais ne bloque pas la requête sinon.
 * Utile pour les routes publiques qui veulent savoir si un utilisateur est connecté.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select('-password');

      if (user && user.isActive) {
        req.user = user;
        console.log(`✅ [OptionalAuth] Utilisateur connecté : ${user.email}`);
      } else {
        req.user = null;
        console.warn('⚠️ [OptionalAuth] Utilisateur inactif ou introuvable');
      }
    } catch (error) {
      console.warn('⚠️ [OptionalAuth] Token invalide ou expiré, continuation sans authentification');
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
 * @description Vérifie que le rôle de l’utilisateur est dans la liste autorisée.
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
 * @description Vérifie que l’utilisateur est soit Admin, soit propriétaire de la propriété.
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

  console.log('🔍 [checkPropertyOwnership]', {
    user: req.user._id,
    property: property._id,
    owner: property.owner,
    isAdmin,
    isOwner,
  });

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
