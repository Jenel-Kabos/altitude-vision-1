// server/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();

const Property     = require('../models/Property');
const Event        = require('../models/Event');
const User         = require('../models/User');
const authController = require('../controllers/authController');

// ============================================================
// 🔒 SÉCURITÉ : Toutes les routes ci-dessous sont protégées
// ============================================================
router.use(authController.protect);
router.use(authController.restrictTo('Admin', 'Collaborateur'));

/**
 * @DESC   Obtenir les statistiques du Dashboard
 * @ROUTE  GET /api/dashboard/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const [propertyCount, eventCount, usersCount, ownersCount] = await Promise.all([
      Property.countDocuments(),
      Event.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ role: 'Proprietaire' }),
    ]);

    // Altcom = portfolio items publiés
    let portfolioCount = 0;
    try {
      const PortfolioItem = require('../models/PortfolioItem');
      portfolioCount = await PortfolioItem.countDocuments({ isPublished: true });
    } catch (e) {
      // Modèle introuvable → reste à 0
    }

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

//fin 