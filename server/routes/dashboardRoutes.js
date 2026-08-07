// server/routes/dashboardRoutes.js
const express = require('express');
const { STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM } = require('../utils/roles');
const router  = express.Router();

const Property       = require('../models/Property');
const Event          = require('../models/Event');
const User           = require('../models/User');
const PortfolioItem  = require('../models/portfolioItemModel'); // ← import au top niveau
const authController = require('../controllers/authController');
const userKpiService = require('../services/userKpiService'); // USER-KPI-1

router.use(authController.protect);
router.use(authController.restrictTo(...STAFF_ALL));

/**
 * @DESC   Obtenir les statistiques du Dashboard
 * @ROUTE  GET /api/dashboard/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const [propertyCount, eventCount, usersCount, kpis, portfolioCount] = await Promise.all([
      Property.countDocuments(),
      Event.countDocuments(),
      User.countDocuments(),
      // USER-KPI-1 — source unique (profils métiers effectifs), remplace
      // l'ancien `User.countDocuments({role:'Proprietaire'})` : préserve le
      // sens historique de la tuile "Owners" (union propriétaire immobilier
      // + exploitant d'établissement, les deux confondues sous l'ancien
      // rôle unique) tout en corrigeant son exactitude (profils dérivés,
      // orthographe accentuée, cohérence avec CRM/Mobile/Dashboard propriétaire).
      userKpiService.getUserKpiSummary(),
      PortfolioItem.countDocuments({ isPublished: true }),
    ]);
    const ownersCount = kpis.proprietaires;

    const statsData = {
      Altimmo:    propertyCount,
      MilaEvents: eventCount,
      Altcom:     portfolioCount,
      Users:      usersCount,
      Owners:     ownersCount,
    };

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