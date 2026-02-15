const Review = require('../models/Review');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Récupérer toutes les reviews (avec filtres optionnels)
 * @route   GET /api/reviews
 * @query   ?pole=Altimmo, ?rating[gte]=4, ?sort=-createdAt
 * @access  Public
 */
exports.getAllReviews = asyncHandler(async (req, res) => {
  let filter = {};

  // ✅ Filtrer par pôle si fourni
  if (req.query.pole) {
    filter.pole = req.query.pole;
  }

  // Filtrer par rating si fourni (ex: ?rating[gte]=4)
  if (req.query.rating) {
    const ratingQuery = {};
    Object.keys(req.query.rating).forEach(key => {
      ratingQuery[`$${key}`] = Number(req.query.rating[key]);
    });
    filter.rating = ratingQuery;
  }

  // Construire la requête
  let query = Review.find(filter);

  // Tri (par défaut: les plus récentes en premier)
  const sortBy = req.query.sort || '-createdAt';
  query = query.sort(sortBy);

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  // Exécuter la requête
  const reviews = await query;

  // Compter le total
  const total = await Review.countDocuments(filter);

  // ✅ CORRECTION : Retourner reviews directement dans data (pas data.reviews)
  res.status(200).json({
    status: 'success',
    results: reviews.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: reviews,  // ← CHANGÉ : data est maintenant directement le tableau
  });
});

/**
 * @desc    Créer une nouvelle review
 * @route   POST /api/reviews
 * @access  Private (utilisateur connecté)
 */
exports.createReview = asyncHandler(async (req, res) => {
  const { rating, comment, pole } = req.body;

  // Validation des données
  if (!rating || !comment || !pole) {
    res.status(400);
    throw new Error('Veuillez fournir une note, un commentaire et un pôle');
  }

  // Vérifier que le pôle est valide
  const validPoles = ['Altimmo', 'MilaEvents', 'Altcom'];
  if (!validPoles.includes(pole)) {
    res.status(400);
    throw new Error('Pôle invalide. Choisissez parmi : Altimmo, MilaEvents, Altcom');
  }

  // Vérifier si l'utilisateur a déjà laissé un avis pour ce pôle
  const existingReview = await Review.findOne({
    pole: pole,
    author: req.user._id,
  });

  if (existingReview) {
    res.status(400);
    throw new Error('Vous avez déjà laissé un avis pour ce pôle');
  }

  // Créer la review
  const review = await Review.create({
    rating,
    comment,
    author: req.user._id,
    pole: pole,
  });

  res.status(201).json({
    status: 'success',
    data: {
      review,
    },
  });
});

/**
 * @desc    Mettre à jour une review
 * @route   PATCH /api/reviews/:id
 * @access  Private (auteur uniquement)
 */
exports.updateReview = asyncHandler(async (req, res) => {
  let review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review non trouvée');
  }

  // ✅ Vérifier que l'utilisateur est l'auteur
  if (review.author._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Vous ne pouvez modifier que vos propres avis');
  }

  // ✅ On ne permet de modifier que rating et comment (pas le pôle)
  const { rating, comment } = req.body;
  
  review = await Review.findByIdAndUpdate(
    req.params.id,
    { rating, comment },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      review,
    },
  });
});

/**
 * @desc    Supprimer une review
 * @route   DELETE /api/reviews/:id
 * @access  Private (Admin uniquement)
 */
exports.deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review non trouvée');
  }

  // ✅ MODIFICATION : Seul l'admin peut supprimer
  if (req.user.role !== 'Admin') {
    res.status(403);
    throw new Error('Seul un administrateur peut supprimer un avis');
  }

  await review.deleteOne();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

/**
 * @desc    Ajouter ou modifier la réponse admin à un avis
 * @route   PATCH /api/reviews/:id/admin-response
 * @access  Private (Admin uniquement)
 */
exports.addAdminResponse = asyncHandler(async (req, res) => {
  const { responseText } = req.body;

  if (!responseText || responseText.trim().length === 0) {
    res.status(400);
    throw new Error('Veuillez fournir une réponse');
  }

  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review non trouvée');
  }

  // ✅ Seul un admin peut répondre
  if (req.user.role !== 'Admin') {
    res.status(403);
    throw new Error('Seul un administrateur peut répondre aux avis');
  }

  // Mettre à jour la réponse admin
  review.adminResponse = {
    text: responseText.trim(),
    respondedAt: new Date(),
    respondedBy: req.user._id,
  };

  await review.save();

  res.status(200).json({
    status: 'success',
    data: {
      review,
    },
  });
});

/**
 * @desc    Supprimer la réponse admin d'un avis
 * @route   DELETE /api/reviews/:id/admin-response
 * @access  Private (Admin uniquement)
 */
exports.deleteAdminResponse = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review non trouvée');
  }

  // ✅ Seul un admin peut supprimer sa réponse
  if (req.user.role !== 'Admin') {
    res.status(403);
    throw new Error('Seul un administrateur peut supprimer une réponse');
  }

  // Réinitialiser la réponse admin
  review.adminResponse = {
    text: null,
    respondedAt: null,
    respondedBy: null,
  };

  await review.save();

  res.status(200).json({
    status: 'success',
    message: 'Réponse admin supprimée',
    data: {
      review,
    },
  });
});