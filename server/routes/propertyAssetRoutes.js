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
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantModule } = require('../middleware/tenantModuleGate');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
const { requireTenantMembershipRoleOrPlatformCapability } = require('../middleware/tenantMembershipRoleOrPlatformCapability');
const ctrl = require('../controllers/propertyAssetController');

const router = express.Router();
router.use(auth.protect);

// GL-ASSET-UX-1 — doit être déclarée AVANT '/:id/...' pour que 'portfolio'
// ne soit jamais capturé comme un identifiant de bien.
// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-2 (2026-09-22) — accepte aussi un
// PlatformOperator actif avec platform.properties.read (ou manage) une fois
// un tenant explicitement sélectionné. Le tenant scope reste strict via
// requireTenantScope + requireTenantModule + service tenantId-mandatory.
router.get('/portfolio/dashboard', requireTenantScope, requireTenantModule('immobilier'),
  requireTenantMembershipRoleOrPlatformCapability({
    tenantRoles: ['Admin', 'GestionnaireImmobilier', 'Collaborateur'],
    platformCapabilities: ['platform.properties.read', 'platform.properties.manage'],
  }), ctrl.getPortfolioDashboard);

router.get('/:id/lifecycle', ctrl.getLifecycle);
router.post('/:id/transition', requireCapability('properties.update'), ctrl.transition);
router.get('/:id/history', ctrl.getHistory);
router.get('/:id/maintenance-logbook', ctrl.getMaintenanceLogbook);
router.get('/:id/valuation', ctrl.getValuation);
router.get('/:id/alerts', ctrl.getAlerts);

module.exports = router;
