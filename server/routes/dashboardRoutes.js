// server/routes/dashboardRoutes.js
const express = require('express');
const { STAFF_ALL } = require('../utils/roles');
const router  = express.Router();

const authController = require('../controllers/authController');
const { getDashboardKpis } = require('../services/dashboardKpiQueryService');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');

router.use(authController.protect);
router.use(requireTenantScope);
router.use(requireTenantMembershipRole(...STAFF_ALL));

/**
 * @DESC   Obtenir les statistiques du Dashboard
 * @ROUTE  GET /api/dashboard/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const statsData = await getDashboardKpis({ scopeUserIds: req.tenantScopeUserIds || [] });

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
