const express = require('express');
const router = express.Router();

const propertyController = require('../controllers/propertyController');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

/* =============================================================
   🧩 ACCÈS RÉSERVÉ À L’ADMINISTRATEUR
============================================================= */
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('Admin')); 

/* =============================================================
   🏠 GESTION DES PROPRIÉTÉS / PUBLICATIONS
============================================================= */

// Route pour obtenir toutes les propriétés (avec filtrage facultatif)
router.route('/properties')
    .get(propertyController.getAllProperties);

// Route spécifique pour les propriétés en attente
router.route('/properties/status/pending')
    .get(propertyController.getPendingProperties);

// Routes d'action sur un ID spécifique (GET détail et DELETE)
router.route('/properties/:id')
    .get(propertyController.getProperty)
    .delete(propertyController.adminDeleteProperty); 


// 🔑 CORRECTION CRITIQUE : Actions de validation/rejet (PATCH)
// Utilisation d'un paramètre dynamique ":action" pour correspondre au contrôleur
// Exemples : PATCH /api/admin/properties/ID_PROPRIETE/validate
//           PATCH /api/admin/properties/ID_PROPRIETE/reject
router.patch(
    '/properties/:id/:action(validate|reject)',
    propertyController.updatePropertyStatus 
);


/* =============================================================
   👤 GESTION DES UTILISATEURS / PROPRIÉTAIRES
============================================================= */

// Route principale /owners
router.route('/owners')
    .get(userController.getAllOwners); 

// Routes d'action sur un ID propriétaire spécifique
router.route('/owners/:id')
    .get(userController.getUser) 
    .delete(userController.deleteUser); 

// Actions spécifiques (PATCH)
router.patch('/owners/:id/verify', userController.verifyOwner);
router.patch('/owners/:id/suspend', userController.suspendUser);
router.patch('/owners/:id/activate', userController.activateUser);


module.exports = router;