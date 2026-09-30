/**
 * @fileoverview Routes API du tableau de bord — accès différencié par rôle.
 *
 * Stats / activité   → tous les collaborateurs
 * Propriétés (read)  → CM, GestionnaireImmobilier
 * Propriétés (write) → Admin uniquement (modération)
 * Utilisateurs       → Admin uniquement
 */

const express = require('express');
const router  = express.Router();
const { STAFF_ALL } = require('../utils/roles');

const adminController = require('../controllers/adminController');
const authController  = require('../controllers/authController');
// SECURITY-CLOSURE-P0-WAVE-1 (P0-E, finding RA-09) — ce fichier duplique un
// flux de modération Property legacy jamais aligné sur le correctif
// TENANT-CERT-2 déjà appliqué à propertyRoutes.js/propertyController.js
// (voir bandeau d'en-tête de propertyController.js) : même garde canonique
// que GET /api/properties/status/pending (HZ-07), réutilisé verbatim.
const { requireTenantScopeForStaffAllowPlatformWide } = require('../middleware/tenantContext');
const {
  requirePlatformOperatorCapability,
  requireTenantBusinessRoleOrPlatformCapability,
} = require('../middleware/platformAuthority');

// ── Authentification obligatoire ──────────────────────────────────
router.use(authController.protect);

const reportingAuthority = requireTenantBusinessRoleOrPlatformCapability({
  tenantRoles: ['Admin', 'GestionnaireImmobilier'],
  platformCapability: 'platform.reporting.read',
});
const propertyReadAuthority = requireTenantBusinessRoleOrPlatformCapability({
  tenantRoles: ['Admin', 'GestionnaireImmobilier', 'CommunityManager', 'Collaborateur'],
  platformCapability: 'platform.properties.read',
});
const propertyManageAuthority = requireTenantBusinessRoleOrPlatformCapability({
  tenantRoles: ['Admin'],
  platformCapability: 'platform.properties.manage',
});

// ── Rôles disponibles pour l'attribution ─────────────────────────
const { ROLE_LABELS } = require('../utils/roles');
router.get('/roles', authController.restrictTo(...STAFF_ALL), (req, res) => {
  const collabRoles = ['Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant'];
  res.json({
    status: 'success',
    data: {
      collabRoles: collabRoles.map(r => ({ value: r, label: ROLE_LABELS[r] })),
      allRoles: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
    },
  });
});

// ── Statistiques & activité (tous les collaborateurs) ────────────
router.get('/stats', requireTenantScopeForStaffAllowPlatformWide, reportingAuthority, adminController.getDashboardStats);
router.get('/activity', requireTenantScopeForStaffAllowPlatformWide, reportingAuthority, adminController.getActivityReport);

// ── Propriétés : lecture (CM + Gestionnaire) ─────────────────────
router.get('/properties/status/pending', requireTenantScopeForStaffAllowPlatformWide, propertyReadAuthority, adminController.getPendingProperties);
router.get('/properties',               requireTenantScopeForStaffAllowPlatformWide, propertyReadAuthority, adminController.getAllProperties);

// ── Propriétés : modération / suppression (Admin uniquement) ─────
router.patch('/properties/:id/approve', requireTenantScopeForStaffAllowPlatformWide, propertyManageAuthority, adminController.approveProperty);
router.patch('/properties/:id/reject',  requireTenantScopeForStaffAllowPlatformWide, propertyManageAuthority, adminController.rejectProperty);
router.delete('/properties/:id',        requireTenantScopeForStaffAllowPlatformWide, propertyManageAuthority, adminController.deleteProperty);

// ── Utilisateurs (Admin uniquement) ──────────────────────────────
router.get('/owners/active-sessions', requirePlatformOperatorCapability('platform.users.read'), adminController.getConnectedUsers);
router.get('/owners',                 requirePlatformOperatorCapability('platform.users.read'), adminController.getAllUsers);
router.patch('/owners/:id/verify',    requirePlatformOperatorCapability('platform.users.manage'), adminController.verifyOwner);
router.patch('/owners/:id/suspend',   requirePlatformOperatorCapability('platform.users.manage'), adminController.suspendUser);
router.patch('/owners/:id/activate',  requirePlatformOperatorCapability('platform.users.manage'), adminController.activateUser);
router.patch('/owners/:id/ban',       requirePlatformOperatorCapability('platform.users.manage'), adminController.banUser);

router.route('/owners/:id')
  .get(   requirePlatformOperatorCapability('platform.users.read'), adminController.getUser)
  .patch( requirePlatformOperatorCapability('platform.users.manage'), adminController.updateUser)
  .delete(requirePlatformOperatorCapability('platform.users.manage'), adminController.deleteUser);

module.exports = router;
