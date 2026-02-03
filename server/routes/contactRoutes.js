const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
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
router.get('/', protect, adminOnly, getAllContactMessages);
router.get('/:id', protect, adminOnly, getContactMessageById);
router.patch('/:id/status', protect, adminOnly, updateMessageStatus);
router.delete('/:id', protect, adminOnly, deleteContactMessage);

module.exports = router;