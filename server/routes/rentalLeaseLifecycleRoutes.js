// GL-LIFE-1 — Routes du cycle de vie du bail. Contrat d'autorité tenant
// canonique :
//   protect
//   → requireTenantScope
//   → requireTenantModule('location')
//   → requireTenantMembershipRole('Admin', 'GestionnaireImmobilier', 'Collaborateur')
//   → router.param('id', assertContratTenantAccessParam)
//
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-A —
// remplace l'ancienne chaîne `auth.protect + auth.restrictTo(...STAFF_IMMO)`
// qui lisait `User.role` global comme source d'autorité tenant. Après
// migration, l'autorité provient EXCLUSIVEMENT d'une OrgMembership active
// avec `businessRole ∈ {Admin, GestionnaireImmobilier, Collaborateur}` sur
// un tenant dont le module `location` est actif — jamais un fallback
// User.role. Le mapping STAFF_IMMO → CANONICAL_IMMO_STAFF_ROLES est
// verbatim identique (`Admin, GestionnaireImmobilier, Collaborateur`,
// voir server/utils/roles.js:47), le contrat commercial staff est donc
// strictement préservé.
//
// SECURITY-CLOSURE-P0-WAVE-1 (P0-D, finding RA-05) — le garde
// `router.param('id', assertContratTenantAccessParam)` reste réutilisé
// verbatim depuis contratRoutes.js/paiementRoutes.js pour l'attribution
// tenant de la ressource `Contrat` (via `Contrat.bien` → `Property.tenant`,
// avec fallback `unresolved-allowed` pour les contrats historiques sans
// `bien` lié — comportement business inchangé).
const express = require('express');
const auth = require('../controllers/authController');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantModule } = require('../middleware/tenantModuleGate');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
const ctrl = require('../controllers/rentalLeaseLifecycleController');

const router = express.Router();
const GL_MANAGE = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];
const tenantAuth = [
  requireTenantScope,
  requireTenantModule('location'),
  requireTenantMembershipRole(...GL_MANAGE),
];

// SECURITY-CLOSURE-P0-WAVE-1 — `router.param('id', …)` s'exécute avant le
// tableau de middlewares propre à chaque route (donc avant les tenantAuth
// listés ci-dessous) : `router.use(auth.protect)` est donc nécessaire
// pour que `req.user` soit déjà défini au moment du contrôle tenant.
router.use(auth.protect);
router.param('id', ctrl.assertContratTenantAccessParam);

router.get('/dashboard', ...tenantAuth, ctrl.dashboard);
router.get('/:id/available-transitions', ...tenantAuth, ctrl.availableTransitions);
router.post('/:id/transition', ...tenantAuth, ctrl.transition);
router.post('/:id/renew/preview', ...tenantAuth, ctrl.previewRenew);
router.post('/:id/renew', ...tenantAuth, ctrl.renew);
router.post('/:id/avenants', ...tenantAuth, ctrl.addAvenant);
router.post('/:id/caution/encaisser', ...tenantAuth, ctrl.encaisserCaution);
router.post('/:id/caution/bloquer', ...tenantAuth, ctrl.bloquerCaution);
router.post('/:id/caution/retenue', ...tenantAuth, ctrl.appliquerRetenueCaution);
router.post('/:id/caution/restituer', ...tenantAuth, ctrl.restituerCaution);

module.exports = router;
