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
const { STAFF_ALL, STAFF_CM, STAFF_IMMO } = require('../utils/roles');

const adminController = require('../controllers/adminController');
const authController  = require('../controllers/authController');

// ── Authentification obligatoire ──────────────────────────────────
router.use(authController.protect);

// ── Portée minimale : tous les collaborateurs ─────────────────────
router.use(authController.restrictTo(...STAFF_ALL));

// ── Admin uniquement (raccourci) ──────────────────────────────────
const adminOnly = authController.restrictTo('Admin');

// ── Rôles disponibles pour l'attribution ─────────────────────────
const { ROLE_LABELS } = require('../utils/roles');
router.get('/roles', (req, res) => {
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
router.get('/stats',    adminController.getDashboardStats);
router.get('/activity', adminController.getActivityReport);

// ── Propriétés : lecture (CM + Gestionnaire) ─────────────────────
router.get('/properties/status/pending', authController.restrictTo(...STAFF_CM, ...STAFF_IMMO), adminController.getPendingProperties);
router.get('/properties',               authController.restrictTo(...STAFF_CM, ...STAFF_IMMO), adminController.getAllProperties);

// ── Propriétés : modération / suppression (Admin uniquement) ─────
router.patch('/properties/:id/approve', adminOnly, adminController.approveProperty);
router.patch('/properties/:id/reject',  adminOnly, adminController.rejectProperty);
router.delete('/properties/:id',        adminOnly, adminController.deleteProperty);

// ── Utilisateurs (Admin uniquement) ──────────────────────────────
router.get('/owners/active-sessions', adminOnly, adminController.getConnectedUsers);
router.get('/owners',                 adminOnly, adminController.getAllUsers);
router.patch('/owners/:id/verify',    adminOnly, adminController.verifyOwner);
router.patch('/owners/:id/suspend',   adminOnly, adminController.suspendUser);
router.patch('/owners/:id/activate',  adminOnly, adminController.activateUser);
router.patch('/owners/:id/ban',       adminOnly, adminController.banUser);

router.route('/owners/:id')
  .get(   adminOnly, adminController.getUser)
  .patch( adminOnly, adminController.updateUser)
  .delete(adminOnly, adminController.deleteUser);

module.exports = router;
