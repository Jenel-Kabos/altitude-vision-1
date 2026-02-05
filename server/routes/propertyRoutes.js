// server/routes/propertyRoutes.js

const express = require('express');
const router = express.Router();
const { protect, optionalAuth, restrictTo, adminOnly, checkPropertyOwnership } = require('../middleware/authMiddleware');

// ✅ CONFIGURATION CLOUDINARY (Import correct)
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

// ⭐ DIAGNOSTIC (Tu pourras le supprimer plus tard)
console.log('🔍 === ROUTE ORDER CHECK ===');
console.log('pending handler:', typeof getPendingProperties);
console.log('=============================');


// ============================================================
// 1️⃣ ROUTES SPÉCIFIQUES ET STATIQUES
// ⚠️ Doivent TOUJOURS être déclarées en premier !
// ============================================================

/**
 * @route GET /api/properties/latest
 * @description Obtenir les dernières propriétés
 */
router.get('/latest', optionalAuth, getLatestProperties, getAllProperties);

/**
 * @route GET /api/properties/status/pending
 * @description Obtenir les propriétés en attente (ADMIN)
 * ✅ FIX 404 : Cette route est maintenant AVANT /:id
 */
router.get('/status/pending', protect, adminOnly, getPendingProperties);

/**
 * @route GET /api/properties/my-properties
 * @description Obtenir les propriétés de l'utilisateur
 */
router.get('/my-properties', protect, getMyProperties);

/**
 * @route GET /api/properties
 * @description Obtenir toutes les propriétés (avec filtres)
 */
router.get('/', optionalAuth, getAllProperties);


// ============================================================
// 2️⃣ CRÉATION
// ============================================================

/**
 * @route POST /api/properties
 * @description Créer une propriété (Upload via Cloudinary)
 */
router.post('/', protect, restrictTo('AdminOnly', 'Proprietaire'), upload.array('images', 10), createProperty);


// ============================================================
// 3️⃣ ROUTES DYNAMIQUES (AVEC :id)
// ⚠️ Doivent être déclarées APRÈS les routes spécifiques
// ============================================================

/**
 * @route PATCH /api/properties/:id/:action
 * @description Valider ou rejeter une propriété (ADMIN)
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


// ============================================================
// 4️⃣ LA ROUTE "CATCH-ALL" (EN DERNIER ABSOLU)
// ============================================================

/**
 * @route GET /api/properties/:id
 * @description Obtenir une propriété par ID
 * ⚠️ Si tu mets cette ligne plus haut, elle bloquera "latest" et "pending"
 */
router.get('/:id', optionalAuth, getProperty);

module.exports = router;