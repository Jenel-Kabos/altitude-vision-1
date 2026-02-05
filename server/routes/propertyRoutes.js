// server/routes/propertyRoutes.js

const express = require('express');
const router = express.Router();
const { protect, optionalAuth, restrictTo, adminOnly, checkPropertyOwnership } = require('../middleware/authMiddleware');

// ✅ Configuration Cloudinary
const upload = require('../config/cloudinary');

const {
  createProperty,
  getAllProperties,
  getProperty,
  updateProperty,
  deleteProperty,
  getMyProperties,
  getPendingProperties,
  updatePropertyStatus,
  adminDeleteProperty,
  getLatestProperties
} = require('../controllers/propertyController');

// ⭐ CODE DE DIAGNOSTIC (Conservé pour debug) ⭐
console.log('🔍 === DIAGNOSTIC DES IMPORTS ===');
console.log('getPendingProperties:', typeof getPendingProperties); // Vérif cruciale
console.log('=================================');

// ============================================================
// 1️⃣ ROUTES SPÉCIFIQUES (STATIQUES)
// ⚠️ Doivent TOUJOURS être en premier pour ne pas être confondues avec des IDs
// ============================================================

/**
 * @route GET /api/properties/latest
 * @description Obtenir les dernières propriétés
 */
router.get('/latest', optionalAuth, getLatestProperties, getAllProperties);

/**
 * @route GET /api/properties/status/pending
 * @description Obtenir les propriétés en attente (ADMIN)
 * ✅ DÉPLACÉ ICI (HAUT) pour éviter l'erreur 404
 */
router.get('/status/pending', protect, adminOnly, getPendingProperties);

/**
 * @route GET /api/properties/my-properties
 * @description Obtenir les propriétés de l'utilisateur
 */
router.get('/my-properties', protect, getMyProperties);

/**
 * @route GET /api/properties
 * @description Obtenir toutes les propriétés
 */
router.get('/', optionalAuth, getAllProperties);

/**
 * @route POST /api/properties
 * @description Créer une propriété (avec Cloudinary)
 */
router.post('/', protect, restrictTo('AdminOnly', 'Proprietaire'), upload.array('images', 10), createProperty);


// ============================================================
// 2️⃣ ROUTES DYNAMIQUES (AVEC PARAMÈTRES :id)
// ⚠️ Doivent être APRÈS les routes spécifiques
// ============================================================

/**
 * @route PATCH /api/properties/:id/:action
 * @description Valider/Rejeter une propriété (ADMIN)
 */
router.patch('/:id/:action', protect, adminOnly, updatePropertyStatus);

/**
 * @route DELETE /api/properties/admin/:id
 * @description Supprimer une propriété (ADMIN)
 */
router.delete('/admin/:id', protect, adminOnly, adminDeleteProperty);

/**
 * @route PUT /api/properties/:id
 * @description Mettre à jour une propriété
 */
router.put('/:id', protect, checkPropertyOwnership, upload.array('images', 10), updateProperty);

/**
 * @route DELETE /api/properties/:id
 * @description Supprimer une propriété
 */
router.delete('/:id', protect, checkPropertyOwnership, deleteProperty);

/**
 * @route GET /api/properties/:id
 * @description Obtenir une propriété par ID
 * ⚠️ LA PLUS GÉNÉRIQUE => TOUJOURS EN DERNIER
 */
router.get('/:id', optionalAuth, getProperty);

module.exports = router;