// server/routes/altcomRoutes.js
const express = require('express');
const { STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM } = require('../utils/roles');
const router = express.Router();

// ✅ IMPORT 1 : Le Contrôleur logique
const altcomController = require('../controllers/altcomController');

// ✅ IMPORT 2 : La Sécurité unifiée (Remplace l'ancien middleware)
const authController = require('../controllers/authController');

// ============================================================
// 🔓 ROUTE PUBLIQUE (Soumission du formulaire)
// ============================================================
// Tout le monde doit pouvoir envoyer un projet sans être connecté
router.post('/projects', altcomController.createProject);


// ============================================================
// 🔒 ROUTES ADMIN (Gestion des projets)
// ============================================================
// Toutes les routes ci-dessous nécessitent d'être connecté ET Admin
router.use(authController.protect);
router.use(authController.restrictTo(...STAFF_CM));

// 📋 Liste des projets
router.get('/projects', altcomController.getAllProjects);

// 🔍 Gestion d'un projet spécifique (Voir & Supprimer)
router.route('/projects/:id')
    .get(altcomController.getProjectById)
    .delete(altcomController.deleteProject);

// ✏️ Mise à jour du statut
router.patch('/projects/:id/status', altcomController.updateProjectStatus);

module.exports = router;