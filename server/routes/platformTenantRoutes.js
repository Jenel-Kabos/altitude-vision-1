// TENANT-CORE-1 — Administration SaaS, réservée Admin (même périmètre que
// ORGANIZATION_ADMIN/API_PLATFORM_ADMIN/ERP_DASHBOARD, dont ce module est
// la couche englobante).
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/platformTenantController');

router.use(auth.protect, auth.restrictTo('Admin'));

router.get('/', controller.listTenants);
router.post('/', controller.createTenant);
router.get('/:id', controller.getTenantOverview);
router.patch('/:id/suspend', controller.suspendTenant);
router.patch('/:id/reactivate', controller.reactivateTenant);
router.patch('/:id/archive', controller.archiveTenant);

router.patch('/:id/settings', controller.updateSettings);
router.patch('/:id/theme', controller.updateTheme);

router.post('/:id/domains', controller.addDomain);
router.patch('/domains/:domainId/verify', controller.verifyDomain);

router.get('/:id/features', controller.listFeatures);
router.patch('/:id/features/:module', controller.setFeature);

router.post('/:id/subscription', controller.changeSubscription);
router.delete('/:id/subscription', controller.cancelSubscription);

module.exports = router;
