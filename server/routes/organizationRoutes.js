// ORGANIZATION-1 — Routes admin de la couche organisationnelle. Écritures
// (créer/archiver/affecter) réservées à Admin ; lecture ouverte au staff
// (même esprit que userBusinessProfileRoutes.js / crmAutomationRoutes.js).
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const { ROLES_DOCS } = require('../utils/roles');
const controller = require('../controllers/organizationController');

router.use(auth.protect);

function staffOnly(req, res, next) {
  if (!ROLES_DOCS.includes(req.user.role)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  next();
}

router.get('/units', staffOnly, controller.listUnits);
router.get('/units/:id/tree', staffOnly, controller.getTree);
router.post('/units', auth.restrictTo('Admin'), controller.createOrgUnit);
router.post('/units/:id/archive', auth.restrictTo('Admin'), controller.archiveOrgUnit);

router.post('/memberships', auth.restrictTo('Admin'), controller.grantMembership);
router.post('/memberships/:id/suspend', auth.restrictTo('Admin'), controller.suspendMembership);
router.post('/memberships/:id/revoke', auth.restrictTo('Admin'), controller.revokeMembership);
router.get('/memberships/user/:userId', staffOnly, controller.getUserMemberships);

module.exports = router;
