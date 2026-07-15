// server/routes/litigeRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/litigeController');
const { protect, optionalAuth, restrictTo } = require('../controllers/authController');
const { upload } = require('../config/cloudinary');
const { ROLES_LITIGES } = require('../utils/roles');

// Upload flexible : images + pdf (fileFilter existant dans cloudinary.js)
const uploadPreuves = upload.array('preuves', 5);

// GET / reste accessible à tout utilisateur connecté (pas de restrictTo) :
// le contrôleur filtre par plaignant/accusé pour les non-admins ("mes litiges").
router.post('/',         optionalAuth, uploadPreuves, ctrl.createLitige);
router.get('/',          protect,                                    ctrl.getLitiges);
router.get('/stats',     protect, restrictTo(...ROLES_LITIGES),       ctrl.getStats);
router.get('/unread-count', protect, restrictTo(...ROLES_LITIGES),    ctrl.getUnreadCount);
router.get('/:id',       protect,                                    ctrl.getLitige);
router.put('/:id/statut',    protect, restrictTo(...ROLES_LITIGES),   ctrl.updateStatut);
router.post('/:id/message',  protect,                                ctrl.addMessage);
router.post('/:id/resolution', protect, restrictTo(...ROLES_LITIGES), ctrl.resolverLitige);

module.exports = router;
