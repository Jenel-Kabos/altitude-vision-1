const express = require('express');
const serviceController = require('../controllers/serviceController');
const authController = require('../controllers/authController');

const router = express.Router();

// --- Routes publiques: consultation des services ---
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getService);

// --- Routes protégées: modification réservée aux Admin et Collaborateur ---
router.use(authController.protect); // Toutes les routes suivantes sont protégées

// Création d’un service (Admin ou Collaborateur)
router.post('/', authController.restrictTo('Admin', 'Collaborateur'), serviceController.createService);

// Mise à jour d’un service (Admin ou Collaborateur)
router.patch('/:id', authController.restrictTo('Admin', 'Collaborateur'), serviceController.updateService);

// Suppression d’un service (uniquement Admin)
router.delete('/:id', authController.restrictTo('Admin'), serviceController.deleteService);

module.exports = router;
