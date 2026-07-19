const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/accommodationController');
const { ROLES_ALTIMMO } = require('../utils/roles');

const router = express.Router();
router.use(auth.protect);

// Propriétaire
router.get('/mine', ctrl.mine);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.post('/:id/submit', ctrl.submit);
router.get('/:id/rate-plans', ctrl.listRates);
router.post('/:id/rate-plans', ctrl.upsertRate);
router.delete('/:id/rate-plans/:rateId', ctrl.deactivateRate);

// Staff — même convention que GET/PATCH /api/properties/:id/:action
router.get('/status/pending', auth.restrictTo(...ROLES_ALTIMMO), ctrl.pending);
router.patch('/:id/:action', auth.restrictTo(...ROLES_ALTIMMO), ctrl.reviewDecision);

module.exports = router;
