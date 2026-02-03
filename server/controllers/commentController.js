// server/controllers/commentController.js
const asyncHandler = require('express-async-handler');
const Comment = require('../models/Comment');
const Property = require('../models/Property');
const Event = require('../models/Event');

/**
 * @description Créer un commentaire
 * @route POST /api/comments
 * @access Protected
 */
exports.createComment = asyncHandler(async (req, res) => {
  const { targetType, targetId, content } = req.body;
  const userId = req.user.id;

  console.log(`💬 [createComment] User: ${userId}, Type: ${targetType}, Target: ${targetId}`);

  // Validation
  if (!targetType || !targetId || !content) {
    res.status(400);
    throw new Error('targetType, targetId et content sont requis');
  }

  if (!['Property', 'Event', 'Service'].includes(targetType)) {
    res.status(400);
    throw new Error('targetType invalide');
  }

  if (content.length < 3 || content.length > 1000) {
    res.status(400);
    throw new Error('Le commentaire doit contenir entre 3 et 1000 caractères');
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

  // Créer le commentaire
  const comment = await Comment.create({
    author: userId,
    targetType,
    targetId,
    content
  });

  // Populate l'auteur
  await comment.populate('author', 'name email avatar');

  console.log(`✅ [createComment] Commentaire créé:`, comment._id);

  res.status(201).json({
    status: 'success',
    message: 'Commentaire créé avec succès',
    data: {
      comment
    }
  });
});

/**
 * @description Obtenir les commentaires d'un élément
 * @route GET /api/comments?targetType=Property&targetId=xxx
 * @access Public
 */
exports.getComments = asyncHandler(async (req, res) => {
  const { targetType, targetId, limit = 20, page = 1 } = req.query;

  console.log(`📖 [getComments] Type: ${targetType}, Target: ${targetId}, Page: ${page}`);

  if (!targetType || !targetId) {
    res.status(400);
    throw new Error('targetType et targetId sont requis');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const comments = await Comment.getComments(targetType, targetId, {
    limit: parseInt(limit),
    skip
  });

  const totalComments = await Comment.countComments(targetType, targetId);

  console.log(`✅ [getComments] ${comments.length} commentaire(s) trouvé(s)`);

  res.status(200).json({
    status: 'success',
    results: comments.length,
    totalComments,
    data: {
      comments
    }
  });
});

/**
 * @description Modifier un commentaire
 * @route PUT /api/comments/:id
 * @access Protected (auteur uniquement)
 */
exports.updateComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  console.log(`✏️ [updateComment] Comment: ${id}, User: ${userId}`);

  if (!content || content.length < 3 || content.length > 1000) {
    res.status(400);
    throw new Error('Le commentaire doit contenir entre 3 et 1000 caractères');
  }

  const comment = await Comment.findById(id);

  if (!comment) {
    res.status(404);
    throw new Error('Commentaire non trouvé');
  }

  // Vérifier que l'utilisateur est l'auteur
  if (comment.author.toString() !== userId) {
    res.status(403);
    throw new Error('Vous ne pouvez modifier que vos propres commentaires');
  }

  await comment.editComment(content);
  await comment.populate('author', 'name email avatar');

  console.log(`✅ [updateComment] Commentaire modifié`);

  res.status(200).json({
    status: 'success',
    message: 'Commentaire modifié avec succès',
    data: {
      comment
    }
  });
});

/**
 * @description Supprimer un commentaire
 * @route DELETE /api/comments/:id
 * @access Protected (auteur ou admin)
 */
exports.deleteComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'Admin';

  console.log(`🗑️ [deleteComment] Comment: ${id}, User: ${userId}, Admin: ${isAdmin}`);

  const comment = await Comment.findById(id);

  if (!comment) {
    res.status(404);
    throw new Error('Commentaire non trouvé');
  }

  // Vérifier que l'utilisateur est l'auteur ou admin
  if (comment.author.toString() !== userId && !isAdmin) {
    res.status(403);
    throw new Error('Vous ne pouvez supprimer que vos propres commentaires');
  }

  await Comment.findByIdAndDelete(id);

  console.log(`✅ [deleteComment] Commentaire supprimé`);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

/**
 * @description Obtenir les commentaires d'un utilisateur
 * @route GET /api/comments/user/:userId
 * @access Public
 */
exports.getUserComments = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = 20, page = 1 } = req.query;

  console.log(`👤 [getUserComments] User: ${userId}, Page: ${page}`);

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const comments = await Comment.find({ author: userId })
    .populate('author', 'name email avatar')
    .sort('-createdAt')
    .limit(parseInt(limit))
    .skip(skip);

  const totalComments = await Comment.countDocuments({ author: userId });

  console.log(`✅ [getUserComments] ${comments.length} commentaire(s) trouvé(s)`);

  res.status(200).json({
    status: 'success',
    results: comments.length,
    totalComments,
    data: {
      comments
    }
  });
});

/**
 * @description Obtenir le nombre de commentaires
 * @route GET /api/comments/count/:targetType/:targetId
 * @access Public
 */
exports.getCommentsCount = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.params;

  const count = await Comment.countComments(targetType, targetId);

  res.status(200).json({
    status: 'success',
    data: {
      count
    }
  });
});