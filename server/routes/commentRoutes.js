// server/routes/commentRoutes.js
const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  getUserComments,
  getCommentsCount
} = require('../controllers/commentController');

// Routes publiques
router.get('/', getComments);
router.get('/count/:targetType/:targetId', getCommentsCount);
router.get('/user/:userId', getUserComments);

// Routes protégées (authentification requise)
router.use(protect);
router.post('/', createComment);
router.put('/:id', updateComment);
router.delete('/:id', deleteComment);

module.exports = router;