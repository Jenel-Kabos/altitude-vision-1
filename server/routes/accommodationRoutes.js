const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/accommodationController');
const { ROLES_ALTIMMO } = require('../utils/roles');
const { upload } = require('../config/cloudinary');

const router = express.Router();
router.use(auth.protect);

// Staff (dashboard admin) — création/édition complète Property+Accommodation+
// RatePlan. Placées AVANT '/:id' pour que '/admin' ne soit jamais capturé par
// le paramètre générique ':id'.
router.post('/admin', auth.restrictTo(...ROLES_ALTIMMO), upload.array('images', 10), ctrl.createFull);
router.put('/admin/:propertyId', auth.restrictTo(...ROLES_ALTIMMO), upload.array('images', 10), ctrl.updateFull);
router.get('/admin/list', auth.restrictTo(...ROLES_ALTIMMO), ctrl.listAdmin);
router.get('/status/pending', auth.restrictTo(...ROLES_ALTIMMO), ctrl.pending);

// Propriétaire
router.get('/mine', ctrl.mine);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/submit', ctrl.submit);
router.post('/:id/duplicate', ctrl.duplicate);
router.patch('/:id/deactivate', ctrl.deactivate);
router.patch('/:id/reactivate', ctrl.reactivate);
router.get('/:id/rate-plans', ctrl.listRates);
router.post('/:id/rate-plans', ctrl.upsertRate);
router.delete('/:id/rate-plans/:rateId', ctrl.deactivateRate);

// Staff — même convention que GET/PATCH /api/properties/:id/:action
// (validate|reject|suspend|unsuspend) — placée en dernier pour ne jamais
// capturer les routes propriétaire ci-dessus (:action est générique).
router.patch('/:id/:action', auth.restrictTo(...ROLES_ALTIMMO), ctrl.reviewDecision);

module.exports = router;
