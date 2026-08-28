const router = require('express').Router();
const auth = require('../controllers/authController');
const controller = require('../controllers/dashboardAnalyticsController');
const { requireTenantScopeForAnalytics } = require('../middleware/tenantContext');

// GET /api/dashboard-analytics/:module — une agrégation consolidée par domaine.
// Le staff doit toujours être tenant-scopé ; seul un PlatformOperator reconnu
// conserve le mode global historique. Les propriétaires self-service restent
// autorisés sans OrgMembership et sont bornés par l'ownership du controller.
router.use(auth.protect, requireTenantScopeForAnalytics);
router.get('/:module(sales|rentals|accommodations|hotels)', controller.getModuleAnalytics);
module.exports = router;
