const router = require('express').Router();
const auth = require('../controllers/authController');
const controller = require('../controllers/dashboardAnalyticsController');

// GET /api/dashboard-analytics/:module — une agrégation consolidée par domaine.
router.use(auth.protect);
router.get('/:module(sales|rentals|accommodations|hotels)', controller.getModuleAnalytics);
module.exports = router;
