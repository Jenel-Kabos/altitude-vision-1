// server/routes/conversationRoutes.js
const express = require('express');
const router = express.Router();

// ✅ IMPORT 1 : Sécurité unifiée
// On utilise authController pour être sûr que les règles (email vérifié, ban, etc.) s'appliquent partout
const authController = require('../controllers/authController');

// ✅ IMPORT 2 : Contrôleur avec les NOUVEAUX noms
const {
  getConversations,
  getConversationMessages,
  markConversationAsRead,
  createOrGetConversation,
  deleteConversation,
  getUnreadCount, // 👈 C'est lui le coupable ! (Renommé pour correspondre au contrôleur)
} = require('../controllers/conversationController');

// 🔒 Protection : Toutes les routes nécessitent d'être connecté
router.use(authController.protect);

// ==========================================================
// --- 📌 Routes principales ---
// ==========================================================

// Compter les messages non lus (doit être AVANT les routes dynamiques)
router.get('/count/unread', getUnreadCount);

// Récupérer toutes les conversations
router.get('/', getConversations);

// Créer ou récupérer une conversation
router.post('/', createOrGetConversation);

// ==========================================================
// --- 🔗 Routes dynamiques (avec conversationId) ---
// ==========================================================

// Récupérer les messages d'une conversation spécifique
router.get('/:conversationId/messages', getConversationMessages);

// Marquer une conversation comme lue
router.patch('/:conversationId/mark-read', markConversationAsRead);

// Supprimer une conversation
router.delete('/:conversationId', deleteConversation);

module.exports = router;