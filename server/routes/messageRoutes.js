// server/routes/messageRoutes.js
// ⚠️ CE FICHIER EST POUR LES CONVERSATIONS EN TEMPS RÉEL UNIQUEMENT
// Pour les emails internes, utilisez /api/internal-mails (internalMailRoutes.js)

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');
const { attachTenantContext, requireTenantScopeForStaffOrPlatformOperator } = require('../middleware/tenantContext');

const uploadAttachments = upload.array('attachments', 5);

const {
    sendMessage,
    getMessages,
    markAsRead,
    deleteMessage,
    getConversations,
    downloadAttachment,
} = require('../controllers/messageController');

// POST-E2E-1 — même correction que conversationRoutes.js : voir ce fichier
// pour le raisonnement complet (bug réel démontré, pas une hypothèse).
router.use(protect, attachTenantContext);

// ==========================================================
// --- 📌 Routes spécifiques (Statiques) ---
// ==========================================================

// Liste des conversations
router.get('/conversations', getConversations);
router.get('/:messageId/attachments/:attachmentId', downloadAttachment);

// ==========================================================
// --- 🔗 Routes dynamiques ---
// ==========================================================

// HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 (HF-FINAL-01) — même frontière
// canonique que conversationRoutes.js (`GET /count/unread`) : pour un
// staff/PlatformOperator dont le contexte tenant est ambigu ou non résolu,
// `sendMessage`/`getMessages` traitaient jusqu'ici l'absence de tenant comme
// « rien à vérifier », permettant un envoi/une lecture cross-tenant via
// `conversationId` (voir TENANT_SCOPE_HORIZONTAL_FINAL_AUDIT1_FINDING_MATRIX.md).
// No-op pour tout autre rôle (Client/Proprietaire) — comportement historique
// intégralement préservé.

// Envoyer un message dans une conversation
router.post('/', requireTenantScopeForStaffOrPlatformOperator, uploadAttachments, sendMessage);

// Récupérer les messages d'une conversation spécifique
router.get('/:conversationId', requireTenantScopeForStaffOrPlatformOperator, getMessages);

// Marquer un message comme lu
router.patch('/:messageId/read', markAsRead);

// Supprimer un message
router.delete('/:messageId', deleteMessage);

module.exports = router;
