// server/routes/conversationRoutes.js
const express = require('express');
const { ALL_STAFF } = require('../utils/roles');
const router = express.Router();

const authController = require('../controllers/authController');
const { requireTenantScope } = require('../middleware/tenantContext');
const { restrictTo } = require('../middleware/authMiddleware');
const {
  getConversationById,
  getConversations,
  getConversationMessages,
  markConversationAsRead,
  createOrGetConversation,  // ⚠️  DÉPRÉCIÉ — conservé pour compat mobile (ouvrirChat)
  deleteConversation,
  getUnreadCount,
  startConversation,        // ✅  NOUVEAU — remplace createOrGetConversation pour les nouveaux flux
  getStaffInbox,            // ✅  NOUVEAU — boîte partagée staff
  getMyInbox,                // ✅  NOUVEAU — ma propre conversation staff-inbox (client)
} = require('../controllers/conversationController');

// 🔒 Toutes les routes nécessitent un token valide
router.use(authController.protect, requireTenantScope);

// ── Routes statiques (AVANT /:conversationId pour éviter les conflits) ──────

// Compteur global de non-lus
router.get('/count/unread', getUnreadCount);

// Boîte partagée staff (Admin + tous sous-rôles collaborateurs)
router.get('/staff-inbox', restrictTo(...ALL_STAFF), getStaffInbox);

// Ma propre conversation staff-inbox (côté client/propriétaire)
router.get('/my-inbox', getMyInbox);

// ✅ Nouvelle route de création — routage staff/client automatique
router.post('/start', startConversation);

// Liste des conversations 1-à-1 de l'utilisateur
router.get('/', getConversations);

// ⚠️  DÉPRÉCIÉ — ancienne création, conservée pour le mobile existant (DetailAnnonceScreen.ouvrirChat)
//     Migrer vers POST /start dès que le mobile est mis à jour.
router.post('/', createOrGetConversation);

// ── Routes dynamiques ────────────────────────────────────────────────────────

// AVANT /:conversationId/messages pour éviter tout conflit de route
router.get('/:conversationId', getConversationById);
router.get('/:conversationId/messages', getConversationMessages);
router.patch('/:conversationId/mark-read', markConversationAsRead);
router.delete('/:conversationId', deleteConversation);

module.exports = router;
