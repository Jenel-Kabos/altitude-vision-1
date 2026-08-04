// GL-ASSET-1 — Phase 9 : routes du patrimoine. Lecture ouverte à tout
// utilisateur authentifié (le contrôleur vérifie ensuite staff-ou-
// propriétaire par bien) ; la transition de cycle de vie reste strictement
// STAFF_IMMO (même groupe que contratRoutes.js/rentalLeaseLifecycleRoutes.js).
const express = require('express');
const auth = require('../controllers/authController');
const { STAFF_IMMO } = require('../utils/roles');
const ctrl = require('../controllers/propertyAssetController');

const router = express.Router();
router.use(auth.protect);

// GL-ASSET-UX-1 — doit être déclarée AVANT '/:id/...' pour que 'portfolio'
// ne soit jamais capturé comme un identifiant de bien.
router.get('/portfolio/dashboard', ctrl.getPortfolioDashboard);

router.get('/:id/lifecycle', ctrl.getLifecycle);
router.post('/:id/transition', auth.restrictTo(...STAFF_IMMO), ctrl.transition);
router.get('/:id/history', ctrl.getHistory);
router.get('/:id/maintenance-logbook', ctrl.getMaintenanceLogbook);
router.get('/:id/valuation', ctrl.getValuation);
router.get('/:id/alerts', ctrl.getAlerts);

module.exports = router;
