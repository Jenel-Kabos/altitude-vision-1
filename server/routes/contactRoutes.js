const express = require('express');
const router = express.Router();
const { protect, adminOnly, restrictTo } = require('../middleware/authMiddleware');
const { ROLES_UNIVERSAL } = require('../utils/roles');
const {
  createContactMessage,
  getAllContactMessages,
  getContactMessageById,
  updateMessageStatus,
  deleteContactMessage,
  getContactStats,
} = require('../controllers/contactController');

// Routes publiques
router.post('/', createContactMessage);

// Routes protégées (Admin)
router.get('/stats', protect, adminOnly, getContactStats);
router.get('/', protect, restrictTo(...ROLES_UNIVERSAL), getAllContactMessages);
router.get('/:id', protect, adminOnly, getContactMessageById);
router.patch('/:id/status', protect, restrictTo(...ROLES_UNIVERSAL), updateMessageStatus);
router.delete('/:id', protect, adminOnly, deleteContactMessage);

module.exports = router;