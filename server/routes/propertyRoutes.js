// server/routes/propertyRoutes.js

const express = require('express');
const router = express.Router();
const { protect, optionalAuth, restrictTo, adminOnly, checkPropertyOwnership } = require('../middleware/authMiddleware');

// ✅ MODIFICATION ICI : On utilise la configuration Cloudinary
const upload = require('../config/cloudinary');
// (Ancienne ligne supprimée : const upload = require('../middleware/uploadMiddleware');)

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
console.log('createProperty:', typeof createProperty);
console.log('getAllProperties:', typeof getAllProperties);
console.log('getProperty:', typeof getProperty);
console.log('updateProperty:', typeof updateProperty);
console.log('deleteProperty:', typeof deleteProperty);
console.log('getMyProperties:', typeof getMyProperties);
console.log('getPendingProperties:', typeof getPendingProperties);
console.log('updatePropertyStatus:', typeof updatePropertyStatus);
console.log('adminDeleteProperty:', typeof adminDeleteProperty);
console.log('getLatestProperties:', typeof getLatestProperties);
console.log('=================================');
// ⭐ FIN DU CODE DE DIAGNOSTIC ⭐

// ==================== ROUTES PUBLIQUES ====================

/**
 * @route GET /api/properties/latest
 * @description Obtenir les dernières propriétés (page d'accueil)
 * @access Public
 * @note optionalAuth pour adapter l'affichage selon l'utilisateur
 * ⚠️ DOIT ÊTRE AVANT /:id pour éviter de confondre 'latest' avec un ID
 */
router.get('/latest', optionalAuth, getLatestProperties, getAllProperties);

/**
 * @route GET /api/properties
 * @description Obtenir toutes les propriétés avec filtres
 * @access Public (mais l'admin voit tout)
 * @note Utilise optionalAuth pour détecter si l'utilisateur est admin
 */
router.get('/', optionalAuth, getAllProperties);

// ==================== ROUTES PROTÉGÉES (UTILISATEUR) ====================

/**
 * @route GET /api/properties/my-properties
 * @description Obtenir les propriétés de l'utilisateur connecté
 * @access Protected (Proprietaire ou Admin)
 * ⚠️ DOIT ÊTRE AVANT /:id pour éviter de confondre 'my-properties' avec un ID
 */
router.get('/my-properties', protect, getMyProperties);

/**
 * @route POST /api/properties
 * @description Créer une nouvelle propriété
 * @access Protected (Proprietaire ou Admin)
 * ✅ Cloudinary gère maintenant l'upload ici
 */
router.post('/', protect, restrictTo('AdminOnly', 'Proprietaire'), upload.array('images', 10), createProperty);

/**
 * @route PUT /api/properties/:id
 * @description Mettre à jour une propriété
 * @access Protected (Admin ou Proprietaire propriétaire de l'annonce)
 * ✅ Utilise checkPropertyOwnership pour vérifier que l'utilisateur est bien le propriétaire
 */
router.put('/:id', protect, checkPropertyOwnership, upload.array('images', 10), updateProperty);

/**
 * @route DELETE /api/properties/:id
 * @description Supprimer une propriété
 * @access Protected (Admin ou Proprietaire propriétaire de l'annonce)
 * ✅ Utilise checkPropertyOwnership pour vérifier que l'utilisateur est bien le propriétaire
 */
router.delete('/:id', protect, checkPropertyOwnership, deleteProperty);

// ==================== ROUTES ADMIN ====================

/**
 * @route GET /api/properties/status/pending
 * @description Obtenir les propriétés en attente de validation
 * @access Protected (Admin uniquement)
 * ⚠️ DOIT ÊTRE AVANT /:id pour éviter de confondre 'status' avec un ID
 */
router.get('/status/pending', protect, adminOnly, getPendingProperties);

/**
 * @route PATCH /api/properties/:id/:action
 * @description Valider ou rejeter une propriété (action = validate ou reject)
 * @access Protected (Admin uniquement)
 */
router.patch('/:id/:action', protect, adminOnly, updatePropertyStatus);

/**
 * @route DELETE /api/properties/admin/:id
 * @description Supprimer une propriété (route admin)
 * @access Protected (Admin uniquement)
 * ⚠️ DOIT ÊTRE AVANT /:id pour éviter de confondre 'admin' avec un ID
 */
router.delete('/admin/:id', protect, adminOnly, adminDeleteProperty);

// ==================== ROUTES DYNAMIQUES (DOIVENT ÊTRE EN DERNIER) ====================

/**
 * @route GET /api/properties/:id
 * @description Obtenir une propriété par ID
 * @access Public (mais seul l'admin ou le propriétaire peut voir les annonces non validées)
 * @note Utilise optionalAuth pour vérifier si l'utilisateur est le propriétaire
 * ⚠️ CETTE ROUTE DOIT ÊTRE EN DERNIER pour ne pas intercepter les routes spécifiques
 */
router.get('/:id', optionalAuth, getProperty);

module.exports = router;