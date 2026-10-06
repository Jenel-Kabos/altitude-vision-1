// PLATFORM-ADMIN-1 — Gestion de l'identité PlatformOperator elle-même.
// Garde capability + scope, jamais une identité User.role :
//   `requirePlatformOperatorCapability('platform.operators.manage')` — un
//      utilisateur SANS cette capacité reçoit 403 sur TOUTES
//      les routes de mutation. Seul `GET /me` échappe à la garde #2 (un
//      utilisateur doit pouvoir vérifier son propre statut sans détenir déjà
//      la capacité de gérer les opérateurs).
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/platformOperatorController');
const { requirePlatformOperatorCapability, requirePlatformGovernanceScope } = require('../middleware/platformAuthority');

router.use(auth.protect);

router.get('/me', controller.getMyOperatorStatus);

router.use(requirePlatformOperatorCapability('platform.operators.manage'));

router.get('/', controller.listOperators);
// PLATFORM-ADMIN-04C2 (C2.0b, D14) — toute mutation d'identité opérateur est
// une opération PLATFORM : refusée sous une sélection de tenant.
router.post('/', requirePlatformGovernanceScope, controller.grantOperator);
router.patch('/:userId/suspend', requirePlatformGovernanceScope, controller.suspendOperator);
router.patch('/:userId/reactivate', requirePlatformGovernanceScope, controller.reactivateOperator);
router.patch('/:userId/revoke', requirePlatformGovernanceScope, controller.revokeOperator);

module.exports = router;
