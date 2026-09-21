// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1D — /api/members.
// Toutes les routes exigent :
//   protect                        (identité authentifiée)
//   attachTenantContext             (tenant canonique résolu)
//   requireTenantMembershipRole('Admin')   (autorité canonique tenant)
// Aucun bypass via User.role, aucun bypass via PlatformOperator. Ce sont
// les Admin(s) réels du tenant qui gèrent leurs propres membres.

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { attachTenantContext } = require('../middleware/tenantContext');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
const controller = require('../controllers/tenantMemberController');

const router = express.Router();

router.use(protect, attachTenantContext, requireTenantMembershipRole('Admin'));

router.get('/', controller.listMembers);
router.get('/search-user', controller.searchGlobalUser);
router.post('/', controller.addMember);
router.patch('/:membershipId', controller.changeRole);
router.post('/:membershipId/suspend', controller.suspend);
router.post('/:membershipId/reactivate', controller.reactivate);
router.delete('/:membershipId', controller.revoke);

// Route-scoped error mapper : le service tenantMemberService lève des
// `TenantMemberError` porteuses de `code`/`statusCode`. Le errorHandler
// global lit `res.statusCode`, on le pose donc explicitement avant de
// relayer, sinon toute erreur métier retomberait en 500.
router.use((err, req, res, next) => {
  if (err && err.name === 'TenantMemberError' && err.statusCode) {
    res.status(err.statusCode);
    return res.json({ status: 'fail', code: err.code, message: err.message });
  }
  return next(err);
});

module.exports = router;
