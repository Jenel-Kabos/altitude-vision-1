// GL-LIFE-1 — Routes du cycle de vie du bail. Même groupe de rôles que
// contratRoutes.js (STAFF_IMMO = Admin/GestionnaireImmobilier/Collaborateur)
// — la gestion du cycle de vie d'un bail est une extension de la gestion
// des contrats, jamais une nouvelle notion de permission.
const express = require('express');
const auth = require('../controllers/authController');
const { STAFF_IMMO } = require('../utils/roles');
const ctrl = require('../controllers/rentalLeaseLifecycleController');

const router = express.Router();
const protect = [auth.protect, auth.restrictTo(...STAFF_IMMO)];

router.get('/dashboard', protect, ctrl.dashboard);
router.get('/:id/available-transitions', protect, ctrl.availableTransitions);
router.post('/:id/transition', protect, ctrl.transition);
router.post('/:id/renew/preview', protect, ctrl.previewRenew);
router.post('/:id/renew', protect, ctrl.renew);
router.post('/:id/avenants', protect, ctrl.addAvenant);
router.post('/:id/caution/encaisser', protect, ctrl.encaisserCaution);
router.post('/:id/caution/bloquer', protect, ctrl.bloquerCaution);
router.post('/:id/caution/retenue', protect, ctrl.appliquerRetenueCaution);
router.post('/:id/caution/restituer', protect, ctrl.restituerCaution);

module.exports = router;
