// ORGANIZATION-1 — Routes admin de la couche organisationnelle. Écritures
// (créer/archiver/affecter) réservées à Admin ; lecture ouverte au staff
// (même esprit que userBusinessProfileRoutes.js / crmAutomationRoutes.js).
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const { ROLES_DOCS } = require('../utils/roles');
const controller = require('../controllers/organizationController');
const { attachTenantContext } = require('../middleware/tenantContext');
const { resolveActiveOperator, hasCapability } = require('../services/platformOperator/platformOperatorService');

router.use(auth.protect, attachTenantContext);

// Legacy tenant-scoped Admin/staff behavior remains available for its own
// organization context. When the actor is a PlatformOperator, organization
// authority is capability-based and never inherited from User.role.
const requireOrganizationCapability = (capability) => async (req, res, next) => {
  if (!req.isPlatformOperatorContext) return next();
  const operator = req.platformOperator || await resolveActiveOperator(req.user?._id || req.user?.id).catch(() => null);
  if (!operator || !hasCapability(operator, capability)) {
    return res.status(403).json({ status: 'fail', message: `Capacité ${capability} requise.` });
  }
  req.platformOperator = operator;
  return next();
};

function staffOnly(req, res, next) {
  if (!ROLES_DOCS.includes(req.user.role)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  next();
}

router.get('/units', staffOnly, requireOrganizationCapability('platform.organization.read'), controller.listUnits);
router.get('/units/:id/tree', staffOnly, requireOrganizationCapability('platform.organization.read'), controller.getTree);
router.post('/units', auth.restrictTo('Admin'), requireOrganizationCapability('platform.organization.manage'), controller.createOrgUnit);
router.post('/units/:id/archive', auth.restrictTo('Admin'), requireOrganizationCapability('platform.organization.manage'), controller.archiveOrgUnit);

router.post('/memberships', auth.restrictTo('Admin'), requireOrganizationCapability('platform.organization.manage'), controller.grantMembership);
router.post('/memberships/:id/suspend', auth.restrictTo('Admin'), requireOrganizationCapability('platform.organization.manage'), controller.suspendMembership);
router.post('/memberships/:id/revoke', auth.restrictTo('Admin'), requireOrganizationCapability('platform.organization.manage'), controller.revokeMembership);
router.get('/memberships/user/:userId', staffOnly, requireOrganizationCapability('platform.organization.read'), controller.getUserMemberships);

module.exports = router;
