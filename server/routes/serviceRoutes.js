const express = require('express');
const router = express.Router();
const { getServices, createService } = require('../controllers/serviceController');
const { protect, admin } = require('../middleware/authMiddleware');

// Route pour la racine '/api/services'
router.route('/')
  // Tout le monde peut voir la liste des services
  .get(getServices)
  
  // Seul un admin connecté peut créer un nouveau service
  // 'protect' vérifie la connexion, 'admin' vérifie le rôle
  .post(protect, admin, createService);

module.exports = router;