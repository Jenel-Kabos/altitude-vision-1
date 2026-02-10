// server/controllers/dashboardController.js
const User = require('../models/User');
const Property = require('../models/Property');
const Event = require('../models/Event');

/**
 * @DESC   Obtenir les statistiques du Dashboard
 * @ROUTE  GET /api/dashboard/stats
 * @ACCESS Private (Admin, Collaborateur)
 */
exports.getDashboardStats = async (req, res) => {
  try {
    console.log('📊 [DashboardController] Requête reçue pour getDashboardStats');

    // 1. Exécuter toutes les requêtes en parallèle pour aller vite
    const [
      usersCount,
      propertiesCount,
      eventsCount,
      ownersCount
    ] = await Promise.all([
      User.countDocuments(),
      Property.countDocuments(),
      Event.countDocuments(),
      User.countDocuments({ role: 'Proprietaire' }) // ✅ Sans accent !
    ]);

    // Comptage des services (Altcom) - gestion si le modèle n'existe pas
    let serviceCount = 0;
    try {
      const Service = require('../models/Service');
      serviceCount = await Service.countDocuments();
    } catch (e) {
      console.log('⚠️ [DashboardController] Modèle Service non trouvé, serviceCount = 0');
    }

    // ✅ Structure des données conforme aux attentes du frontend
    const statsData = {
      Altimmo: propertiesCount,
      MilaEvents: eventsCount,
      Altcom: serviceCount,
      Users: usersCount,
      Owners: ownersCount
    };

    console.log('✅ [DashboardController] Stats calculées:', statsData);

    // 2. Renvoyer les résultats avec la bonne structure
    res.status(200).json({
      status: 'success',
      data: {
        stats: statsData
      }
    });

  } catch (error) {
    console.error('❌ [DashboardController] Erreur lors du chargement des stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Impossible de récupérer les statistiques.',
      error: error.message
    });
  }
};