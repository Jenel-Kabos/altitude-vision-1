// GL-ASSET-1 — Phase 9 : routes du patrimoine. Lecture ouverte à tout
// utilisateur authentifié (le contrôleur vérifie ensuite staff-ou-
// propriétaire par bien) ; la transition de cycle de vie reste strictement
// STAFF_IMMO (même groupe que contratRoutes.js/rentalLeaseLifecycleRoutes.js).
//
// RBAC-2 — route pilote de migration vers `requireCapability`. `'properties.update'`
// résout exactement à {Admin, GestionnaireImmobilier, Collaborateur} = STAFF_IMMO
// (parité prouvée par test, voir __tests__/propertyAssetRoutes.mongo.integration.test.js
// describe "POST /transition — matrice de rôles complète") — choisie parmi les
// capacités déjà déclarées dans iamArchitecture.js plutôt que d'en créer une
// nouvelle (RBAC2_CAPABILITY_NAMING_MATRIX.md).
const express = require('express');
const auth = require('../controllers/authController');
const { requireCapability } = require('../middleware/capabilityMiddleware');
const ctrl = require('../controllers/propertyAssetController');

const router = express.Router();
router.use(auth.protect);

// GL-ASSET-UX-1 — doit être déclarée AVANT '/:id/...' pour que 'portfolio'
// ne soit jamais capturé comme un identifiant de bien.
router.get('/portfolio/dashboard', ctrl.getPortfolioDashboard);

router.get('/:id/lifecycle', ctrl.getLifecycle);
router.post('/:id/transition', requireCapability('properties.update'), ctrl.transition);
router.get('/:id/history', ctrl.getHistory);
router.get('/:id/maintenance-logbook', ctrl.getMaintenanceLogbook);
router.get('/:id/valuation', ctrl.getValuation);
router.get('/:id/alerts', ctrl.getAlerts);

module.exports = router;
