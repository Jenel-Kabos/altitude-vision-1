// server/routes/litigeRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/litigeController');
const { protect, optionalAuth, restrictTo } = require('../controllers/authController');
const { upload } = require('../config/cloudinary');
const { ROLES_LITIGES } = require('../utils/roles');
// SECURITY-CLOSURE-P1-WAVE-1 (P1-C, finding RA-07) — même garde que
// HF-FINAL-01/Messaging : `requireTenantScopeForStaffOrPlatformOperator` est
// conditionné par rôle (`requireWhen`) — no-op pour un non-staff (les
// participants d'un litige, jamais bloqués), fail-closed uniquement pour un
// staff/PlatformOperator sans tenant résolu. Applicable donc uniformément à
// toutes les routes, mixtes ou strictement staff.
const { requireTenantScopeForStaffOrPlatformOperator } = require('../middleware/tenantContext');

// Upload flexible : images + pdf (fileFilter existant dans cloudinary.js)
const uploadPreuves = upload.array('preuves', 5);

// GET / reste accessible à tout utilisateur connecté (pas de restrictTo) :
// le contrôleur filtre par plaignant/accusé pour les non-admins ("mes litiges").
router.post('/',         optionalAuth, uploadPreuves, ctrl.createLitige);
router.get('/',          protect, requireTenantScopeForStaffOrPlatformOperator,                              ctrl.getLitiges);
router.get('/stats',     protect, restrictTo(...ROLES_LITIGES), requireTenantScopeForStaffOrPlatformOperator, ctrl.getStats);
router.get('/unread-count', protect, restrictTo(...ROLES_LITIGES), requireTenantScopeForStaffOrPlatformOperator, ctrl.getUnreadCount);
router.get('/:id/proofs/:proofIndex', protect, requireTenantScopeForStaffOrPlatformOperator,                 ctrl.downloadProof);
router.get('/:id',       protect, requireTenantScopeForStaffOrPlatformOperator,                              ctrl.getLitige);
router.put('/:id/statut',    protect, restrictTo(...ROLES_LITIGES), requireTenantScopeForStaffOrPlatformOperator, ctrl.updateStatut);
router.post('/:id/message',  protect, requireTenantScopeForStaffOrPlatformOperator,                          ctrl.addMessage);
router.post('/:id/resolution', protect, restrictTo(...ROLES_LITIGES), requireTenantScopeForStaffOrPlatformOperator, ctrl.resolverLitige);

module.exports = router;
