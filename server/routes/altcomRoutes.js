const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createProject,
  getAllProjects,
  getProjectById,
  updateProjectStatus,
  deleteProject,
} = require('../controllers/altcomController');

// Routes publiques
router.post('/projects', createProject);

// Routes protégées (Admin)
router.get('/projects', protect, adminOnly, getAllProjects);
router.get('/projects/:id', protect, adminOnly, getProjectById);
router.patch('/projects/:id/status', protect, adminOnly, updateProjectStatus);
router.delete('/projects/:id', protect, adminOnly, deleteProject);

module.exports = router;