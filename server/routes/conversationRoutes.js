// server/routes/conversationRoutes.js
const express = require('express');
const { ALL_STAFF } = require('../utils/roles');
const router = express.Router();

const authController = require('../controllers/authController');
const { attachTenantContext, requireTenantScopeForStaffOrPlatformOperator } = require('../middleware/tenantContext');
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

// 🔒 Toutes les routes nécessitent un token valide.
// POST-E2E-1 — `requireTenantScope` bloquait ICI, avant même d'atteindre le
// contrôleur, tout client ordinaire (jamais de PlatformTenant propre par
// design — voir tenantContextService.js) : bug réel démontré, Messaging
// totalement inaccessible pour cet acteur. `attachTenantContext` résout
// `req.platformTenant` sans jamais bloquer ; la frontière tenant reste
// appliquée dans chaque contrôleur UNIQUEMENT quand `req.platformTenant`
// existe (staff), jamais retirée pour cet acteur — voir
// conversationController.js/messageController.js pour le détail.
// `GET /staff-inbox` reste gardée séparément par `restrictTo(...ALL_STAFF)`
// ci-dessous, inchangé.
router.use(authController.protect, attachTenantContext);

// ── Routes statiques (AVANT /:conversationId pour éviter les conflits) ──────

// Compteur global de non-lus
router.get('/count/unread', requireTenantScopeForStaffOrPlatformOperator, getUnreadCount);

// HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 (HF-FINAL-01) — `attachTenantContext`
// ci-dessus ne bloque jamais, y compris pour un STAFF dont le contexte
// tenant est ambigu (membre de plusieurs tenants sans en-tête
// `X-Platform-Tenant-Id`) ou totalement non résolu (aucune adhésion) :
// `getStaffInbox`/`assertConversationAccess` (utilisée par les 4 routes
// dynamiques ci-dessous) traitaient jusqu'ici cette absence comme « rien à
// vérifier » plutôt que « refuser », permettant un accès cross-tenant en
// lecture/suppression (démontré par
// TENANT_SCOPE_HORIZONTAL_FINAL_AUDIT1_FINDING_MATRIX.md, HF-FINAL-01).
// `requireTenantScopeForStaffOrPlatformOperator` est la frontière canonique
// DÉJÀ utilisée ci-dessus par `GET /count/unread` (jamais un nouveau
// mécanisme) : pour un staff/PlatformOperator, elle exige un tenant résolu
// (403 sinon) ; pour tout autre rôle (Client/Proprietaire, jamais de
// PlatformTenant propre par design), elle ne fait strictement rien
// (`requireWhen` renvoie `false`, `next()` immédiat) — le comportement
// historique client/propriétaire sur CES MÊMES routes (accès à sa propre
// conversation en tant que participant) reste intégralement inchangé.
// Volontairement appliquée UNIQUEMENT aux routes déjà démontrées
// vulnérables — `/my-inbox`, `/`, `/start`, `POST /` restent hors périmètre
// de ce hotfix (déjà sûres par construction, bornées par
// `participants: req.user.id` ou un calcul serveur du tenant, jamais
// affectées par HF-FINAL-01 — voir ENDPOINT_MATRIX.md).

// Boîte partagée staff (Admin + tous sous-rôles collaborateurs)
router.get('/staff-inbox', restrictTo(...ALL_STAFF), requireTenantScopeForStaffOrPlatformOperator, getStaffInbox);

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
router.get('/:conversationId', requireTenantScopeForStaffOrPlatformOperator, getConversationById);
router.get('/:conversationId/messages', requireTenantScopeForStaffOrPlatformOperator, getConversationMessages);
router.patch('/:conversationId/mark-read', requireTenantScopeForStaffOrPlatformOperator, markConversationAsRead);
router.delete('/:conversationId', requireTenantScopeForStaffOrPlatformOperator, deleteConversation);

module.exports = router;
