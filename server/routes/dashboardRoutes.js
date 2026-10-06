// server/routes/dashboardRoutes.js
const express = require('express');
const { STAFF_ALL } = require('../utils/roles');
const router  = express.Router();

const authController = require('../controllers/authController');
const { getDashboardKpis } = require('../services/dashboardKpiQueryService');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantMembershipRoleOrPlatformCapability } = require('../middleware/tenantMembershipRoleOrPlatformCapability');

router.use(authController.protect);
router.use(requireTenantScope);
// PLATFORM-ADMIN-04B1 — Home en contexte TENANT : tenant sélectionné requis
// (requireTenantScope ci-dessus, jamais de repli global), puis autorité
// canonique Pattern 1 — adhésion métier du tenant (PATH A) OU PlatformOperator
// actif détenant la capability exacte du pilotage (PATH B), la même que la
// surface PLATFORM équivalente `/api/admin/stats`. Sans ce PATH B, un
// administrateur plateforme sans adhésion dans le tenant sélectionné recevait
// 403 « Aucune adhésion tenant active ».
router.use(requireTenantMembershipRoleOrPlatformCapability({
  tenantRoles: STAFF_ALL,
  platformCapabilities: ['platform.reporting.read'],
}));

/**
 * @DESC   Obtenir les statistiques du Dashboard
 * @ROUTE  GET /api/dashboard/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const statsData = await getDashboardKpis({
      scopeUserIds: req.tenantScopeUserIds || [],
      tenantId: req.adminScope?.tenantId,
    });

    res.status(200).json({
      status: 'success',
      data: { stats: statsData },
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors du chargement des statistiques.',
      error: error.message,
    });
  }
});

module.exports = router;
