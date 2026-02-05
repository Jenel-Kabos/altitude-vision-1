// server/controllers/dashboardController.js
const User = require('../models/User');
const Property = require('../models/Property');
const Event = require('../models/Event');
// Ajoute d'autres modèles si nécessaire (ex: Message, Quote)

exports.getDashboardStats = async (req, res) => {
  try {
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

    // 2. Renvoyer les résultats
    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          users: usersCount,
          properties: propertiesCount,
          events: eventsCount,
          owners: ownersCount
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur Dashboard Stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Impossible de récupérer les statistiques.',
      error: error.message
    });
  }
};