// server/routes/propertyRoutes.js
const express = require('express');
const router = express.Router();

// ✅ IMPORT 1 : Le contrôleur Auth (Sécurité unifiée)
const authController = require('../controllers/authController');

// ✅ IMPORT 2 : Configuration Cloudinary
const upload = require('../config/cloudinary');

// ✅ IMPORT 3 : Le contrôleur Property
const propertyController = require('../controllers/propertyController');

// ============================================================
// 1️⃣ ROUTES SPÉCIFIQUES (Doivent être EN PREMIER)
// ============================================================

/**
 * @route GET /api/properties/latest
 * @description Les dernières propriétés (Public)
 */
router.get('/latest', propertyController.getLatestProperties, propertyController.getAllProperties);

/**
 * @route GET /api/properties/status/pending
 * @description Propriétés en attente (ADMIN UNIQUEMENT)
 * ✅ Placé ici pour éviter le conflit avec /:id
 */
router.get(
    '/status/pending', 
    authController.protect, 
    authController.restrictTo('Admin'), 
    propertyController.getPendingProperties
);

/**
 * @route GET /api/properties/my-properties
 * @description Propriétés de l'utilisateur connecté
 */
router.get(
    '/my-properties', 
    authController.protect, 
    propertyController.getMyProperties
);

/**
 * @route GET /api/properties
 * @description Toutes les propriétés avec filtres
 */
router.get(
    '/', 
    authController.optionalAuth, 
    propertyController.getAllProperties
);


// ============================================================
// 2️⃣ ROUTE DE CRÉATION
// ============================================================

/**
 * @route POST /api/properties
 * @description Créer une propriété + Upload images
 * ✅ Correction du rôle : 'Admin' (et pas AdminOnly)
 */
router.post(
    '/', 
    authController.protect, 
    authController.restrictTo('Admin', 'Proprietaire'), 
    upload.array('images', 10), 
    propertyController.createProperty
);


// ============================================================
// 3️⃣ ROUTES ADMIN SPÉCIFIQUES
// ============================================================

/**
 * @route PATCH /api/properties/admin/:id/:action
 * @description Valider ou Rejeter (Admin)
 */
router.patch(
    '/admin/:id/:action', 
    authController.protect, 
    authController.restrictTo('Admin'), 
    propertyController.updatePropertyStatus
);

/**
 * @route DELETE /api/properties/admin/:id
 * @description Suppression forcée (Admin)
 */
router.delete(
    '/admin/:id', 
    authController.protect, 
    authController.restrictTo('Admin'), 
    propertyController.adminDeleteProperty
);


// ============================================================
// 4️⃣ ROUTES DYNAMIQUES PAR ID (EN DERNIER)
// ============================================================

/**
 * @route PUT /api/properties/:id
 * @description Mise à jour (Propriétaire ou Admin)
 * Note: La vérification de propriété est faite dans le contrôleur
 */
router.put(
    '/:id', 
    authController.protect, 
    authController.restrictTo('Admin', 'Proprietaire'), 
    upload.array('images', 10), 
    propertyController.updateProperty
);

/**
 * @route DELETE /api/properties/:id
 * @description Suppression (Propriétaire ou Admin)
 */
router.delete(
    '/:id', 
    authController.protect, 
    authController.restrictTo('Admin', 'Proprietaire'), 
    propertyController.deleteProperty
);

/**
 * @route GET /api/properties/:id
 * @description Détail d'une propriété (Public ou Privé selon statut)
 * ⚠️ C'est la route "Catch-All", elle doit être tout en bas !
 */
router.get(
    '/:id', 
    authController.optionalAuth, 
    propertyController.getProperty
);

module.exports = router;