// CRM-AUTOMATION-1 — Routes admin du moteur d'automatisation. Même
// périmètre staff que crmRoutes.js ; les écritures (créer/modifier/activer)
// sont réservées à Admin/GestionnaireImmobilier, la lecture (règles,
// journal, score, cockpit) au staff CRM au sens large.
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/crmAutomationController');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantMembershipRoleOrPlatformCapability } = require('../middleware/tenantMembershipRoleOrPlatformCapability');

// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-6 (2026-09-22) — mêmes helpers que
// crmRoutes.js. Read STAFF, Write MANAGERS-only (rules/simulate) — PATH A
// strictement préservé. PATH B via platform.crm.read / platform.crm.manage.
const STAFF = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'Secretaire', 'CommunityManager', 'Communicant'];
const MANAGERS = ['Admin', 'GestionnaireImmobilier'];

const crmRead = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: STAFF,
  platformCapabilities: ['platform.crm.read', 'platform.crm.manage'],
});
const crmManagerManage = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: MANAGERS,
  platformCapabilities: ['platform.crm.manage'],
});

router.use(auth.protect, requireTenantScope);

router.get('/rules', crmRead, controller.listRules);
router.post('/rules', crmManagerManage, controller.createRule);
router.patch('/rules/:id', crmManagerManage, controller.updateRule);
router.patch('/rules/:id/enabled', crmManagerManage, controller.setEnabled);
router.post('/simulate', crmManagerManage, controller.simulate);
router.get('/runs', crmRead, controller.listRuns);
router.get('/score/:customerId', crmRead, controller.getCustomerScore);
router.get('/cockpit', crmRead, controller.getCockpit);

module.exports = router;
