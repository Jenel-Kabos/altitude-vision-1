// server/routes/actionLogRoutes.js
const express    = require('express');
const router     = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const ctrl       = require('../controllers/actionLogController');
const { requireTenantScope } = require('../middleware/tenantContext');

router.use(protect);
router.use(restrictTo('Admin'));
router.use(requireTenantScope);

router.get('/',        ctrl.getLogs);
router.get('/stats',   ctrl.getStats);
router.get('/recent',  ctrl.getRecent);
router.get('/export',  ctrl.exportCsv);

module.exports = router;
