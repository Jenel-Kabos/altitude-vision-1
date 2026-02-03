// --- routes/projectRoutes.js ---

import express from 'express';
import {
  createProject,
  getMyProjects,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from '../controllers/projectController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- Sécurisation Globale ---
// Toutes les routes liées aux projets nécessitent une authentification.
router.use(protect);

// --- Routes Générales ---
router.route('/')
  .post(createProject); // Un utilisateur connecté peut créer un projet.

// --- Routes Spécifiques aux Rôles ---
// Un utilisateur demande la liste de SES projets.
router.get('/my-projects', getMyProjects);

// Un admin demande la liste de TOUS les projets.
router.get('/all', admin, getAllProjects);


// --- Routes pour un Projet Spécifique ---
// L'utilisateur doit être le propriétaire ou un admin pour y accéder.
// La vérification est faite dans le controller.
router.route('/:id')
  .get(getProjectById)
  .put(updateProject)
  .delete(deleteProject);

export default router;