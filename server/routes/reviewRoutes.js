const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');

// mergeParams:true permet à ce routeur de récupérer les paramètres du parent (ex: :portfolioItemId)
const router = express.Router({ mergeParams: true });

/* ================================
   🚀 PUBLIC ROUTES
   ================================ */

// ✅ N'importe qui peut consulter les avis
router
  .route('/')
  .get(reviewController.getAllReviews);

/* ================================
   🔒 PROTECTED ROUTES
   ================================ */

// Les routes suivantes nécessitent un utilisateur connecté
router.use(authController.protect);

// ✅ Seuls les clients, prestataires ou admin peuvent créer un avis
router
  .route('/')
  .post(
    authController.restrictTo('Client', 'Prestataire', 'Admin'),
    reviewController.createReview
  );

// ✅ Seul l'auteur de l'avis ou un admin peut le supprimer
router
  .route('/:id')
  .delete(reviewController.deleteReview);

module.exports = router;
