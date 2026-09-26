const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/crmController');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantMembershipRoleOrPlatformCapability } = require('../middleware/tenantMembershipRoleOrPlatformCapability');

// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-6 (2026-09-22) — composition helpers.
// PATH A préserve exactement les rôles historiques (STAFF pour lectures et
// mutations larges, MANAGERS pour /consolidations). PATH B ajoute un
// PlatformOperator actif + capability dédiée avec tenant explicitement
// sélectionné. Aucune vue platform-wide, aucun bypass User.role, aucune
// mutation cross-domain (Property/Contrat/Transaction/HotelReservation
// restent en lecture seule dans crmService pour hydrater la vue 360°).
const STAFF = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'Secretaire', 'CommunityManager', 'Communicant'];
const MANAGERS = ['Admin', 'GestionnaireImmobilier'];

const crmRead = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: STAFF,
  platformCapabilities: ['platform.crm.read', 'platform.crm.manage'],
});
const crmStaffManage = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: STAFF,
  platformCapabilities: ['platform.crm.manage'],
});
const crmManagerManage = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: MANAGERS,
  platformCapabilities: ['platform.crm.manage'],
});

router.use(auth.protect, requireTenantScope);

router.post('/sync', crmStaffManage, controller.sync);
router.get('/dashboard', crmRead, controller.dashboard);
router.get('/pipeline', crmRead, controller.pipeline);
router.get('/activities', crmRead, controller.activities);
router.get('/search', crmRead, controller.search);
router.get('/duplicates', crmRead, controller.duplicates);
router.get('/duplicates/:customerA/:customerB', crmRead, controller.compare);
router.get('/consolidations', crmRead, controller.consolidations);
router.post('/consolidations', crmManagerManage, controller.consolidate);
router.get('/customers', crmRead, controller.listCustomers);
router.get('/customers/:customerId', crmRead, controller.getCustomer);
router.post('/customers/:customerId/opportunities', crmStaffManage, controller.createOpportunity);
router.patch('/opportunities/:opportunityId/stage', crmStaffManage, controller.moveOpportunity);
router.patch('/opportunities/:opportunityId/outcome', crmStaffManage, controller.setOpportunityOutcome);
router.post('/customers/:customerId/activities', crmStaffManage, controller.createActivity);
router.patch('/activities/:activityId', crmStaffManage, controller.updateActivity);

module.exports = router;
