// server/routes/messageRoutes.js
// ⚠️ CE FICHIER EST POUR LES CONVERSATIONS EN TEMPS RÉEL UNIQUEMENT
// Pour les emails internes, utilisez /api/internal-mails (internalMailRoutes.js)

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadAttachments } = require('../middleware/uploadMiddleware');

const {
    sendMessage,
    getMessages,
    markAsRead,
    deleteMessage,
    getConversations,
} = require('../controllers/messageController');

// ==========================================================
// --- 📌 Routes spécifiques (Statiques) ---
// ==========================================================

// Liste des conversations
router.get('/conversations', protect, getConversations);

// ==========================================================
// --- 🔗 Routes dynamiques ---
// ==========================================================

// Envoyer un message dans une conversation
router.post('/', protect, uploadAttachments, sendMessage); 

// Récupérer les messages d'une conversation spécifique
router.get('/:conversationId', protect, getMessages); 

// Marquer un message comme lu
router.patch('/:messageId/read', protect, markAsRead);

// Supprimer un message
router.delete('/:messageId', protect, deleteMessage);

module.exports = router;