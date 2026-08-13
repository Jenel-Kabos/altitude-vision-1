// PLATFORM-ADMIN-1 — Gestion de l'identité PlatformOperator elle-même.
// Garde à deux niveaux, jamais un seul (mission §44) :
//   1. `auth.restrictTo('Admin')` — même périmètre de base que
//      platformTenantRoutes.js/apiPlatformAdminRoutes.js ;
//   2. `requireOperatorCapability('platform.operators.manage')` — un Tenant
//      Admin (role Admin, mais SANS cette capacité) reçoit 403 sur TOUTES
//      les routes de mutation. Seul `GET /me` échappe à la garde #2 (un
//      utilisateur doit pouvoir vérifier son propre statut sans détenir déjà
//      la capacité de gérer les opérateurs).
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/platformOperatorController');
const { resolveActiveOperator, hasCapability } = require('../services/platformOperator/platformOperatorService');

router.use(auth.protect, auth.restrictTo('Admin'));

router.get('/me', controller.getMyOperatorStatus);

const requireOperatorCapability = (capability) => async (req, res, next) => {
  const operator = await resolveActiveOperator(req.user._id || req.user.id).catch(() => null);
  if (!operator || !hasCapability(operator, capability)) {
    return res.status(403).json({ status: 'fail', message: 'Action refusée : capacité opérateur plateforme requise.' });
  }
  next();
};

router.use(requireOperatorCapability('platform.operators.manage'));

router.get('/', controller.listOperators);
router.post('/', controller.grantOperator);
router.patch('/:userId/suspend', controller.suspendOperator);
router.patch('/:userId/reactivate', controller.reactivateOperator);
router.patch('/:userId/revoke', controller.revokeOperator);

module.exports = router;
