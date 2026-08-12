// server/routes/exportRoutes.js
const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/exportController');
const { requireTenantScope } = require('../middleware/tenantContext');

router.use(protect);
router.use(restrictTo('Admin'));
router.use(requireTenantScope);

router.get('/contacts',        ctrl.getContacts);
router.get('/contacts/stats',  ctrl.getStats);
router.get('/contacts/csv',    ctrl.exportCsv);

module.exports = router;
