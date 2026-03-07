// server/routes/dashboardRoutes.js
const express = require('express');
const router  = express.Router();

const Property       = require('../models/Property');
const Event          = require('../models/Event');
const User           = require('../models/User');
const PortfolioItem  = require('../models/portfolioItemModel'); // ← import au top niveau
const authController = require('../controllers/authController');

router.use(authController.protect);
router.use(authController.restrictTo('Admin', 'Collaborateur'));

/**
 * @DESC   Obtenir les statistiques du Dashboard
 * @ROUTE  GET /api/dashboard/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const [propertyCount, eventCount, usersCount, ownersCount, portfolioCount] = await Promise.all([
      Property.countDocuments(),
      Event.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ role: 'Proprietaire' }),
      PortfolioItem.countDocuments({ isPublished: true }),
    ]);

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