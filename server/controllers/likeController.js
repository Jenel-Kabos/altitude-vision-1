// server/controllers/likeController.js
const asyncHandler = require('express-async-handler');
const Like = require('../models/Like');
const Property = require('../models/Property');
const Event = require('../models/Event');
const logger = require('../utils/logger');

/**
 * @description Liker/Unliker un élément
 * @route POST /api/likes
 * @access Protected
 */
exports.toggleLike = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.body;
  const userId = req.user.id;

  logger.info(`📍 [toggleLike] User: ${userId}, Type: ${targetType}, Target: ${targetId}`);

  // Validation
  if (!targetType || !targetId) {
    res.status(400);
    throw new Error('targetType et targetId sont requis');
  }

  if (!['Property', 'Event', 'Service'].includes(targetType)) {
    res.status(400);
    throw new Error('targetType invalide');
  }

  // Vérifier que la cible existe
  let targetExists = false;
  if (targetType === 'Property') {
    targetExists = await Property.findById(targetId);
  } else if (targetType === 'Event') {
    targetExists = await Event.findById(targetId);
  }

  if (!targetExists) {
    res.status(404);
    throw new Error(`${targetType} non trouvé`);
  }

  // Vérifier si déjà liké
  const existingLike = await Like.findOne({
    user: userId,
    targetType,
    targetId
  });

  if (existingLike) {
    // Unliker
    await Like.findByIdAndDelete(existingLike._id);
    logger.info(`💔 [toggleLike] Unlike effectué`);

    const likesCount = await Like.countLikes(targetType, targetId);

    return res.status(200).json({
      status: 'success',
      message: 'Like retiré',
      data: {
        liked: false,
        likesCount
      }
    });
  } else {
    // Liker
    const newLike = await Like.create({
      user: userId,
      targetType,
      targetId
    });

    logger.info(`❤️ [toggleLike] Like effectué:`, newLike._id);

    const likesCount = await Like.countLikes(targetType, targetId);

    return res.status(201).json({
      status: 'success',
      message: 'Like ajouté',
      data: {
        liked: true,
        likesCount,
        like: newLike
      }
    });
  }
});

/**
 * @description Obtenir le statut de like et le nombre de likes
 * @route GET /api/likes/status/:targetType/:targetId
 * @access Public (optionalAuth pour savoir si l'utilisateur a liké)
 */
exports.getLikeStatus = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.params;
  const userId = req.user?.id;

  logger.info(`📊 [getLikeStatus] Type: ${targetType}, Target: ${targetId}, User: ${userId || 'Non authentifié'}`);

  // Compter les likes
  const likesCount = await Like.countLikes(targetType, targetId);

  // Vérifier si l'utilisateur a liké (si authentifié)
  let liked = false;
  if (userId) {
    liked = await Like.hasUserLiked(userId, targetType, targetId);
  }

  res.status(200).json({
    status: 'success',
    data: {
      likesCount,
      liked
    }
  });
});

/**
 * @description Obtenir les favoris de l'utilisateur
 * @route GET /api/likes/my-favorites
 * @access Protected
 */
const FAVORITES_PROPERTY_SELECT = 'title name description price images date location';

/**
 * Favoris "Property" : source canonique = Property.likes[] (alimentée par le
 * cœur réel, DetailAnnonceScreen.jsx / PropertyDetailPage.jsx via
 * POST /properties/:id/like). Union en LECTURE SEULE avec les documents Like
 * legacy (targetType='Property'), toujours écrits par un second chemin réel
 * et actif : LikeButton dans PropertyCard.jsx (POST /api/likes). Aucune
 * écriture supplémentaire n'est faite ici — voir
 * server/docs/HOTFIX_FAVORITES_CANONICAL_PROPERTY_LIKES1_REPORT.md (§24/§25).
 * `likedAt` n'existe que pour les entrées issues de la collection Like ;
 * Property.likes[] ne porte aucune date par utilisateur (limitation
 * documentée, non inventée).
 */
async function getFavoriteProperties(userId) {
  const [canonicalProperties, legacyLikes] = await Promise.all([
    Property.find({ likes: userId }).select(FAVORITES_PROPERTY_SELECT).lean(),
    Like.find({ user: userId, targetType: 'Property' })
      .sort('-createdAt')
      .populate({ path: 'targetId', select: FAVORITES_PROPERTY_SELECT })
      .lean(),
  ]);

  const byId = new Map();
  canonicalProperties.forEach((property) => {
    byId.set(property._id.toString(), { ...property, likedAt: undefined });
  });
  legacyLikes.forEach((like) => {
    if (!like.targetId) return; // Bien supprimé depuis — cible legacy ignorée
    const idStr = like.targetId._id.toString();
    const existing = byId.get(idStr);
    if (existing) {
      if (existing.likedAt === undefined) existing.likedAt = like.createdAt;
    } else {
      byId.set(idStr, { ...like.targetId, likedAt: like.createdAt });
    }
  });

  return Array.from(byId.values()).sort((a, b) => {
    if (a.likedAt && b.likedAt) return new Date(b.likedAt) - new Date(a.likedAt);
    if (a.likedAt) return -1;
    if (b.likedAt) return 1;
    return 0;
  });
}

exports.getMyFavorites = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { type } = req.query; // Filtrer par type (optionnel)

  logger.info(`⭐ [getMyFavorites] User: ${userId}, Type: ${type || 'Tous'}`);

  const favorites = {
    properties: [],
    events: [],
    services: []
  };

  if (!type || type === 'Property') {
    favorites.properties = await getFavoriteProperties(userId);
  }

  if (!type || type === 'Event' || type === 'Service') {
    const eventServiceTypes = type ? [type] : ['Event', 'Service'];
    const likes = await Like.find({ user: userId, targetType: { $in: eventServiceTypes } })
      .sort('-createdAt')
      .populate({ path: 'targetId', select: FAVORITES_PROPERTY_SELECT });

    likes.forEach(like => {
      if (!like.targetId) return; // Ignorer si la cible a été supprimée

      if (like.targetType === 'Event') {
        favorites.events.push({ ...like.targetId.toObject(), likedAt: like.createdAt });
      } else if (like.targetType === 'Service') {
        favorites.services.push({ ...like.targetId.toObject(), likedAt: like.createdAt });
      }
    });
  }

  const totalResults = favorites.properties.length + favorites.events.length + favorites.services.length;

  logger.success(`✅ [getMyFavorites] ${totalResults} favori(s) trouvé(s)`);

  res.status(200).json({
    status: 'success',
    results: totalResults,
    data: {
      favorites
    }
  });
});

/**
 * @description Obtenir tous les utilisateurs qui ont liké un élément
 * @route GET /api/likes/users/:targetType/:targetId
 * @access Public
 */
exports.getLikeUsers = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.params;

  logger.info(`👥 [getLikeUsers] Type: ${targetType}, Target: ${targetId}`);

  const likes = await Like.find({ targetType, targetId })
    .populate('user', 'name email avatar')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: likes.length,
    data: {
      users: likes.map(like => ({
        user: like.user,
        likedAt: like.createdAt
      }))
    }
  });
});