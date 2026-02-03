// --- controllers/projectController.js ---

import asyncHandler from 'express-async-handler';
import Project from '../models/projectModel.js';
import AppError from '../utils/appError.js';

/**
 * @desc    Create a new project
 * @route   POST /api/projects
 * @access  Private
 */
const createProject = asyncHandler(async (req, res, next) => {
  const { name, description, property, service } = req.body;

  if (!name || !property || !service) {
    return next(new AppError('Le nom, la propriété et le service sont requis.', 400));
  }

  const project = await Project.create({
    user: req.user._id, // Assigner le projet à l'utilisateur connecté
    name,
    description,
    property,
    service,
  });

  res.status(201).json({
    success: true,
    data: project,
  });
});

/**
 * @desc    Get logged-in user's projects
 * @route   GET /api/projects/my-projects
 * @access  Private
 */
const getMyProjects = asyncHandler(async (req, res, next) => {
  const projects = await Project.find({ user: req.user._id })
    .populate('service', 'name')
    .populate('property', 'address');

  res.status(200).json({
    success: true,
    count: projects.length,
    data: projects,
  });
});

/**
 * @desc    Get all projects
 * @route   GET /api/projects/all
 * @access  Private/Admin
 */
const getAllProjects = asyncHandler(async (req, res, next) => {
  const projects = await Project.find({})
    .populate('user', 'name email')
    .populate('service', 'name');

  res.status(200).json({
    success: true,
    count: projects.length,
    data: projects,
  });
});

/**
 * @desc    Get a single project by ID
 * @route   GET /api/projects/:id
 * @access  Private
 */
const getProjectById = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return next(new AppError('Aucun projet trouvé avec cet ID.', 404));
  }

  // SÉCURITÉ : L'utilisateur doit être le propriétaire du projet ou un admin.
  if (project.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('Action non autorisée.', 403));
  }

  res.status(200).json({
    success: true,
    data: project,
  });
});

/**
 * @desc    Update a project
 * @route   PUT /api/projects/:id
 * @access  Private
 */
const updateProject = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return next(new AppError('Aucun projet trouvé avec cet ID.', 404));
  }

  // SÉCURITÉ : Seul le propriétaire ou un admin peut modifier.
  if (project.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('Action non autorisée.', 403));
  }

  const updatedProject = await Project.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: updatedProject,
  });
});

/**
 * @desc    Delete a project
 * @route   DELETE /api/projects/:id
 * @access  Private
 */
const deleteProject = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return next(new AppError('Aucun projet trouvé avec cet ID.', 404));
  }

  // SÉCURITÉ : Seul le propriétaire ou un admin peut supprimer.
  if (project.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('Action non autorisée.', 403));
  }

  await project.deleteOne();

  res.status(200).json({ success: true, message: 'Projet supprimé.' });
});

export {
  createProject,
  getMyProjects,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
};