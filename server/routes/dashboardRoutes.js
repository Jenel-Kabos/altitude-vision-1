// server/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();

// ✅ IMPORTS DES MODÈLES
const Property = require('../models/Property');
const Event = require('../models/Event');
const User = require('../models/User');

// ✅ IMPORT DU CONTRÔLEUR D'AUTH (Pour la sécurité unifiée)
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
    console.log('📊 [Dashboard] Requête reçue pour /stats');

    // Exécution des requêtes en parallèle pour la rapidité
    const [propertyCount, eventCount, usersCount, ownersCount] = await Promise.all([
      Property.countDocuments(),
      Event.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ role: 'Proprietaire' }) // ✅ Sans accent !
    ]);

    // Comptage des services (Altcom) - gestion si le modèle n'existe pas
    let serviceCount = 0;
    try {
      const Service = require('../models/Service');
      serviceCount = await Service.countDocuments();
    } catch (e) {
      console.log('⚠️ [Dashboard] Modèle Service non trouvé, serviceCount = 0');
      // Si le modèle Service n'existe pas, on reste à 0
    }

    // ✅ Structure des données conforme aux attentes du frontend
    const statsData = {
      Altimmo: propertyCount,
      MilaEvents: eventCount,
      Altcom: serviceCount,
      Users: usersCount,
      Owners: ownersCount
    };

    console.log('✅ [Dashboard] Stats calculées:', statsData);

    res.status(200).json({
      status: 'success',
      data: {
        stats: statsData
      },
    });

  } catch (error) {
    console.error('🚨 [Dashboard] Erreur lors du chargement des stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors du chargement des statistiques.',
      error: error.message
    });
  }
});

module.exports = router;