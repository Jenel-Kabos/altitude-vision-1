const express = require('express');
const reviewController = require('../controllers/reviewController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

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
router.use(protect);

// ✅ Tous les utilisateurs connectés peuvent créer un avis
router
  .route('/')
  .post(reviewController.createReview);

// ✅ L'auteur peut modifier son avis
router
  .route('/:id')
  .patch(reviewController.updateReview);

/* ================================
   🔐 ADMIN ONLY ROUTES
   ================================ */

// ✅ Seul l'admin peut supprimer un avis
router
  .route('/:id')
  .delete(adminOnly, reviewController.deleteReview);

// ✅ Seul l'admin peut ajouter/modifier/supprimer une réponse
router
  .route('/:id/admin-response')
  .patch(adminOnly, reviewController.addAdminResponse)
  .delete(adminOnly, reviewController.deleteAdminResponse);

module.exports = router;