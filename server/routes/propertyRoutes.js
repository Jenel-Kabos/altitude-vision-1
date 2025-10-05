const express = require('express');
const router = express.Router();

// Import des fonctions du contrôleur
const { 
  getProperties, 
  getPropertyById,
  createProperty, 
  updateProperty, 
  deleteProperty,
  getAllPropertiesForAdmin,
  approveProperty
} = require('../controllers/propertyController');

// Import des middlewares
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// --- Routes pour la collection de biens ---
router.route('/')
  // Route publique pour voir tous les biens publiés
  .get(getProperties)
  // Route privée pour soumettre un nouveau bien (avec upload d'image)
  .post(protect, upload.single('image'), createProperty);

// --- Routes d'administration spécifiques ---
// Doit être définie avant la route '/:id' pour éviter les conflits
router.route('/admin/all')
  // Route admin pour voir TOUS les biens (publiés ou non)
  .get(protect, admin, getAllPropertiesForAdmin);

// --- Routes pour un bien spécifique identifié par son ID ---
router.route('/:id')
  // Route publique pour voir les détails d'un bien
  .get(getPropertyById)
  // Route privée pour que le propriétaire ou un admin puisse modifier le bien
  .put(protect, updateProperty)
  // Route privée pour que le propriétaire ou un admin puisse supprimer le bien
  .delete(protect, deleteProperty);

// --- Route d'administration pour approuver un bien ---
router.route('/:id/approve')
  // Route admin pour publier un bien en attente
  .put(protect, admin, approveProperty);

module.exports = router;