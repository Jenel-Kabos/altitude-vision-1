// ERP-CORE-1 — Centre d'Administration Global, réservé à la Direction
// (Admin) — même périmètre que ORGANIZATION_ADMIN et API_PLATFORM_ADMIN,
// dont ce centre orchestre justement la vue consolidée.
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/erpController');
const { requireTenantScope } = require('../middleware/tenantContext');

router.use(auth.protect, auth.restrictTo('Admin'), requireTenantScope);

router.get('/executive', controller.getExecutiveOverview);
router.get('/alerts', controller.getAlerts);
router.get('/decisions', controller.getDecisionCenter);
router.get('/health', controller.getPlatformHealth);

module.exports = router;
