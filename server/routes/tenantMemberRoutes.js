// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1D — /api/members.
// PLATFORM-SUPER-ADMIN OPTION-3 (2026-09-22) — la garde d'autorité passe de
// `requireTenantMembershipRole('Admin')` (tenant-only) à
// `requireTenantMembershipRoleOrPlatformCapability(...)` — une composition
// EXPLICITE de deux chemins d'autorité mutuellement exclusifs :
//
//   PATH A (tenant) : OrgMembership active dans le tenant sélectionné
//                     avec businessRole ∈ tenantRoles.
//   PATH B (platform) : PlatformOperator actif avec la platform capability
//                     appropriée (users.read pour la lecture, users.manage
//                     pour la mutation), tenant explicitement sélectionné
//                     via X-Platform-Tenant-Id (pas de tenant → refusé).
//
// Aucun bypass User.role, aucun OrgMembership artificiel. La frontière
// tenant reste appliquée en aval par tenantMemberService (loadMembershipInTenant
// vérifie String(m.orgUnit) === String(tenant.rootOrgUnit)). L'invariant
// last-admin distribué reste appliqué par le service — ni un tenant Admin ni
// un PlatformOperator ne peut démoter/suspendre/révoquer le dernier Admin.

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { attachTenantContext } = require('../middleware/tenantContext');
const { requireTenantMembershipRoleOrPlatformCapability } = require('../middleware/tenantMembershipRoleOrPlatformCapability');
const controller = require('../controllers/tenantMemberController');

const router = express.Router();

router.use(protect, attachTenantContext);

// Lecture : platform.users.read (ou users.manage) suffit côté plateforme ;
// businessRole Admin suffit côté tenant.
const readAuthority = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: ['Admin'],
  platformCapabilities: ['platform.users.read', 'platform.users.manage'],
});

// Mutation : platform.users.manage requis côté plateforme ; businessRole
// Admin requis côté tenant. platform.users.read seul ne peut jamais muter.
const writeAuthority = requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: ['Admin'],
  platformCapabilities: ['platform.users.manage'],
});

router.get('/', readAuthority, controller.listMembers);
router.get('/search-user', readAuthority, controller.searchGlobalUser);
router.post('/', writeAuthority, controller.addMember);
router.patch('/:membershipId', writeAuthority, controller.changeRole);
router.post('/:membershipId/suspend', writeAuthority, controller.suspend);
router.post('/:membershipId/reactivate', writeAuthority, controller.reactivate);
router.delete('/:membershipId', writeAuthority, controller.revoke);

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
