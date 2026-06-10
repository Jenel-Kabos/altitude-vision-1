// server/routes/litigeRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/litigeController');
const { protect, optionalAuth, restrictTo } = require('../controllers/authController');
const { upload } = require('../config/cloudinary');

// Upload flexible : images + pdf (fileFilter existant dans cloudinary.js)
const uploadPreuves = upload.array('preuves', 5);

router.post('/',         optionalAuth, uploadPreuves, ctrl.createLitige);
router.get('/',          protect,                     ctrl.getLitiges);
router.get('/stats',     protect, restrictTo('Admin'), ctrl.getStats);
router.get('/:id',       protect,                     ctrl.getLitige);
router.put('/:id/statut',    protect, restrictTo('Admin'), ctrl.updateStatut);
router.post('/:id/message',  protect,                     ctrl.addMessage);
router.post('/:id/resolution', protect, restrictTo('Admin'), ctrl.resolverLitige);

module.exports = router;
