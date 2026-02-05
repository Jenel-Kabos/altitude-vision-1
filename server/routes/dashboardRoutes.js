// server/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();

// ✅ IMPORTS DES MODÈLES
const Property = require('../models/Property');
const Event = require('../models/Event');
const User = require('../models/User');
// Si tu n'as pas de fichier models/Service.js, commente la ligne ci-dessous ou remplace par Portfolio
// const Service = require('../models/Service'); 

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
    // Exécution des requêtes en parallèle pour la rapidité
    // Note: Si Service n'existe pas, retire serviceCount de la liste
    const [propertyCount, eventCount, usersCount, ownersCount] = await Promise.all([
      Property.countDocuments(),
      Event.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ role: 'Proprietaire' }) // ✅ Sans accent !
    ]);

    // On prépare les données (ajout de Service si tu as le modèle)
    let serviceCount = 0;
    try {
        // Tentative de comptage des services si le modèle existe
        const Service = require('../models/Service');
        serviceCount = await Service.countDocuments();
    } catch (e) {
        // Ignorer si le modèle Service n'existe pas
    }

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
            Altimmo: propertyCount,
            MilaEvents: eventCount,
            Altcom: serviceCount,
            Users: usersCount,
            Owners: ownersCount
        }
      },
    });

  } catch (error) {
    console.error('🚨 Erreur Dashboard Stats :', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors du chargement des statistiques.',
      error: error.message
    });
  }
});

module.exports = router;