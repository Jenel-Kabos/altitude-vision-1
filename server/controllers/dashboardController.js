// server/controllers/dashboardController.js
const User         = require('../models/User');
const Property     = require('../models/Property');
const Event        = require('../models/Event');

/**
 * @DESC   Obtenir les statistiques du Dashboard
 * @ROUTE  GET /api/dashboard/stats
 * @ACCESS Private (Admin, Collaborateur)
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const [usersCount, propertiesCount, eventsCount, ownersCount] = await Promise.all([
      User.countDocuments(),
      Property.countDocuments(),
      Event.countDocuments(),
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
      Altimmo:    propertiesCount,
      MilaEvents: eventsCount,
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
      message: 'Impossible de récupérer les statistiques.',
      error: error.message,
    });
  }
};

//fin