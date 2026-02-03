// routes/dashboardRoutes.js
const express = require('express');
const Property = require('../models/Property');
const Event = require('../models/Event');
const Service = require('../models/Service');
const { protect, admin } = require('../middleware/authMiddleware'); // <-- utiliser admin pour les droits Admin

const router = express.Router();

// helper restrictTo générique pour CommonJS
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403);
    throw new Error("Accès refusé. Vous n'avez pas les permissions nécessaires.");
  }
  next();
};

/**
 * @DESC  Get Dashboard Stats (Admin | Collaborateur)
 * @ROUTE GET /api/dashboard/stats
 * @ACCESS Protected (Admin, Collaborateur)
 */
router.get(
  '/stats',
  protect,
  restrictTo('Admin', 'Collaborateur'),
  async (req, res) => {
    try {
      const [propertyCount, eventCount, serviceCount] = await Promise.all([
        Property.countDocuments(),
        Event.countDocuments(),
        Service.countDocuments(),
      ]);

      return res.status(200).json({
        status: 'success',
        data: {
          Altimmo: propertyCount,
          MilaEvents: eventCount,
          Altcom: serviceCount,
        },
      });
    } catch (error) {
      console.error('🚨 Erreur Dashboard Stats :', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erreur serveur lors du chargement des statistiques',
      });
    }
  }
);

module.exports = router;
