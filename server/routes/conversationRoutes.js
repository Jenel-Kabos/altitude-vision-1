// server/routes/conversationRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const {
  getConversations,
  getConversationMessages,
  markConversationAsRead,
  createOrGetConversation,
  deleteConversation,
  countUnreadMessages,
} = require('../controllers/conversationController');

// ==========================================================
// --- 📌 Routes principales ---
// ==========================================================

// Compter les messages non lus (doit être AVANT les routes dynamiques)
router.get('/count/unread', protect, countUnreadMessages);

// Récupérer toutes les conversations
router.get('/', protect, getConversations);

// Créer ou récupérer une conversation
router.post('/', protect, createOrGetConversation);

// ==========================================================
// --- 🔗 Routes dynamiques (avec conversationId) ---
// ==========================================================

// Récupérer les messages d'une conversation spécifique
router.get('/:conversationId/messages', protect, getConversationMessages);

// Marquer une conversation comme lue
router.patch('/:conversationId/mark-read', protect, markConversationAsRead);

// Supprimer une conversation
router.delete('/:conversationId', protect, deleteConversation);

module.exports = router;