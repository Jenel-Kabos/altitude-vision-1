const Review = require('../models/Review');
const PortfolioItem = require('../models/portfolioItemModel');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Récupérer toutes les reviews (avec filtres optionnels)
 * @route   GET /api/reviews
 * @query   ?portfolioItem=xxx, ?rating[gte]=4, ?sort=-createdAt
 * @access  Public
 */
exports.getAllReviews = asyncHandler(async (req, res) => {
  let filter = {};

  // Filtrer par portfolioItem si fourni
  if (req.params.portfolioItemId) {
    filter.portfolioItem = req.params.portfolioItemId;
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
  const reviews = await query.populate('portfolioItem', 'title pole category');

  // Compter le total
  const total = await Review.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: {
      reviews,
    },
  });
});

/**
 * @desc    Créer une nouvelle review
 * @route   POST /api/portfolio/:portfolioItemId/reviews
 * @access  Private (utilisateur connecté)
 */
exports.createReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  // Vérifier que le portfolioItem existe
  const portfolioItem = await PortfolioItem.findById(req.params.portfolioItemId);
  if (!portfolioItem) {
    res.status(404);
    throw new Error('Élément de portfolio non trouvé');
  }

  // Vérifier si l'utilisateur a déjà laissé un avis
  const existingReview = await Review.findOne({
    portfolioItem: req.params.portfolioItemId,
    author: req.user._id,
  });

  if (existingReview) {
    res.status(400);
    throw new Error('Vous avez déjà laissé un avis pour cet élément');
  }

  // Créer la review
  const review = await Review.create({
    rating,
    comment,
    author: req.user._id,
    portfolioItem: req.params.portfolioItemId,
  });

  // Recalculer la note moyenne du portfolioItem
  await PortfolioItem.calcAverageRating(req.params.portfolioItemId);

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

  // Vérifier que l'utilisateur est l'auteur ou un admin
  if (review.author.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
    res.status(403);
    throw new Error('Vous ne pouvez modifier que vos propres avis');
  }

  review = await Review.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  // Recalculer la note moyenne
  await PortfolioItem.calcAverageRating(review.portfolioItem);

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
 * @access  Private (auteur ou admin)
 */
exports.deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review non trouvée');
  }

  // Vérifier les permissions
  if (review.author.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
    res.status(403);
    throw new Error('Vous ne pouvez supprimer que vos propres avis');
  }

  const portfolioItemId = review.portfolioItem;
  
  await review.deleteOne();

  // Recalculer la note moyenne
  await PortfolioItem.calcAverageRating(portfolioItemId);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});