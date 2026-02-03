const express = require('express');
const portfolioController = require('../controllers/portfolioController');
const authController = require('../controllers/authController');
const reviewRouter = require('./reviewRoutes'); // Importation du routeur pour les avis

const router = express.Router();

// --- Route Imbriquée ---
// Si une requête arrive sur '/:portfolioItemId/reviews',
// elle sera gérée par le routeur d'avis (reviewRouter).
// C'est la clé pour le système de notation.
router.use('/:portfolioItemId/reviews', reviewRouter);

// --- Routes Publiques ---
// N'importe qui peut consulter les réalisations du portfolio.
router.route('/').get(portfolioController.getAllPortfolioItems);
router.route('/:id').get(portfolioController.getPortfolioItem);

// --- Routes Protégées ---
// Seuls les administrateurs et collaborateurs peuvent ajouter ou modifier le portfolio.
router.use(authController.protect, authController.restrictTo('Admin', 'Collaborateur'));

router.route('/').post(portfolioController.createPortfolioItem);

router
  .route('/:id')
  .patch(portfolioController.updatePortfolioItem)
  .delete(authController.restrictTo('Admin'), portfolioController.deletePortfolioItem); // Seul un admin peut supprimer

module.exports = router;