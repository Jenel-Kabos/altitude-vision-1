const express = require('express');
const router = express.Router();
const { 
  getProjects, 
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  createProjectReview
} = require('../controllers/projectController');
const { protect, admin } = require('../middleware/authMiddleware');

// Route pour la collection de projets '/api/projects'
router.route('/')
  .get(getProjects)
  .post(protect, admin, createProject);

// Routes pour un projet spécifique
router.route('/:id')
  .get(getProjectById) // Tout le monde peut voir un projet
  .put(protect, admin, updateProject) // Seul un admin peut modifier
  .delete(protect, admin, deleteProject); // Seul un admin peut supprimer

// Route pour ajouter un avis à un projet spécifique
router.route('/:id/reviews').post(protect, createProjectReview);

module.e