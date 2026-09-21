// PLATFORM-ADMIN-1 — Gestion de l'identité PlatformOperator elle-même.
// Garde à deux niveaux, jamais un seul (mission §44) :
//   1. `requireGlobalAdmin` — identité globale User.role='Admin', sans
//      dépendance à un tenant ou une OrgMembership ;
//   2. `requirePlatformOperatorCapability('platform.operators.manage')` — un
//      Admin global SANS cette capacité reçoit 403 sur TOUTES
//      les routes de mutation. Seul `GET /me` échappe à la garde #2 (un
//      utilisateur doit pouvoir vérifier son propre statut sans détenir déjà
//      la capacité de gérer les opérateurs).
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/platformOperatorController');
const { requireGlobalAdmin, requirePlatformOperatorCapability } = require('../middleware/platformAuthority');

router.use(auth.protect, requireGlobalAdmin);

router.get('/me', controller.getMyOperatorStatus);

router.use(requirePlatformOperatorCapability('platform.operators.manage'));

router.get('/', controller.listOperators);
router.post('/', controller.grantOperator);
router.patch('/:userId/suspend', controller.suspendOperator);
router.patch('/:userId/reactivate', controller.reactivateOperator);
router.patch('/:userId/revoke', controller.revokeOperator);

module.exports = router;
