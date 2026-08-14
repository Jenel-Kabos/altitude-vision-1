// server/routes/rentalMaintenanceRoutes.js — Sprint GL-B2
// Ownership vérifiée dans le contrôleur (propriétaire du bien ou staff ROLES_GL).

const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/rentalMaintenanceController');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireCapabilityForStaff } = require('../middleware/capabilityMiddleware');

const router = express.Router();
router.use(auth.protect, requireTenantScope);

router.get('/', requireCapabilityForStaff('maintenance.read'), ctrl.list);
router.get('/:id/attachments/:attachmentIndex', requireCapabilityForStaff('maintenance.read'), ctrl.downloadAttachment);
router.post('/', requireCapabilityForStaff('maintenance.manage'), ctrl.create);
router.patch('/:id/assign', requireCapabilityForStaff('maintenance.manage'), ctrl.assign);
router.patch('/:id/schedule', requireCapabilityForStaff('maintenance.manage'), ctrl.schedule);
router.patch('/:id/start', requireCapabilityForStaff('maintenance.manage'), ctrl.start);
router.patch('/:id/resolve', requireCapabilityForStaff('maintenance.manage'), ctrl.resolve);
router.patch('/:id/close', requireCapabilityForStaff('maintenance.manage'), ctrl.close);

module.exports = router;
