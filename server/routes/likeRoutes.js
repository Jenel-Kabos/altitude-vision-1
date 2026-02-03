// server/routes/likeRoutes.js
const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const {
  toggleLike,
  getLikeStatus,
  getMyFavorites,
  getLikeUsers
} = require('../controllers/likeController');

// Routes publiques (avec optionalAuth pour détecter si l'utilisateur est connecté)
router.get('/status/:targetType/:targetId', optionalAuth, getLikeStatus);
router.get('/users/:targetType/:targetId', getLikeUsers);

// Routes protégées (authentification requise)
router.use(protect);
router.post('/', toggleLike);
router.get('/my-favorites', getMyFavorites);

module.exports = router;