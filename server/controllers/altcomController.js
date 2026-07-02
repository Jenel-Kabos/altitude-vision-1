const asyncHandler = require('express-async-handler');
const AltcomProject = require('../models/AltcomProject');
const { notifyStaff } = require('../services/notificationService');

/**
 * @description Créer un nouveau projet Altcom
 * @route POST /api/altcom/projects
 * @access Public
 */
exports.createProject = asyncHandler(async (req, res) => {
  console.log('📥 [Altcom] Réception d\'un nouveau projet:', req.body);

  const {
    projectName,
    companyName,
    contactName,
    email,
    phone,
    projectType,
    projectCategory,
    targetAudience,
    objectives,
    budget,
    startDate,
    deadline,
    detailedDescription,
    currentSituation,
    expectedResults,
    hasExistingMaterials,
    materialsDescription,
  } = req.body;

  // Validation
  if (!projectName || !contactName || !email || !detailedDescription || !projectType) {
    res.status(400);
    throw new Error('Veuillez remplir tous les champs obligatoires.');
  }

  // Créer le projet
  const project = await AltcomProject.create({
    projectName,
    companyName,
    contactName,
    email,
    phone,
    projectType,
    projectCategory,
    targetAudience,
    objectives,
    budget,
    startDate,
    deadline,
    detailedDescription,
    currentSituation,
    expectedResults,
    hasExistingMaterials,
    materialsDescription,
  });

  console.log('✅ [Altcom] Projet créé avec succès:', project._id);

  notifyStaff({
    type:  'quote_received',
    title: 'Nouveau projet Altcom 📣',
    body:  `"${project.projectName}" soumis par ${project.contactName} — type: ${project.projectType}.`,
    data:  { screen: 'AdminQuotes', params: { id: project._id } },
  }).catch(() => {});

  res.status(201).json({
    status: 'success',
    message: 'Projet soumis avec succès',
    data: {
      project: {
        id: project._id,
        projectName: project.projectName,
        status: project.status,
        submittedAt: project.submittedAt,
      },
    },
  });
});

/**
 * @description Obtenir tous les projets Altcom (Admin)
 * @route GET /api/altcom/projects
 * @access Protected (Admin)
 */
exports.getAllProjects = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  }

  const projects = await AltcomProject.find(filter).sort({ submittedAt: -1 });

  res.status(200).json({
    status: 'success',
    results: projects.length,
    data: {
      projects,
    },
  });
});

/**
 * @description Obtenir un projet par ID (Admin)
 * @route GET /api/altcom/projects/:id
 * @access Protected (Admin)
 */
exports.getProjectById = asyncHandler(async (req, res) => {
  const project = await AltcomProject.findById(req.params.id);

  if (!project) {
    res.status(404);
    throw new Error('Projet non trouvé.');
  }

  res.status(200).json({
    status: 'success',
    data: {
      project,
    },
  });
});

/**
 * @description Mettre à jour le statut d'un projet (Admin)
 * @route PATCH /api/altcom/projects/:id/status
 * @access Protected (Admin)
 */
exports.updateProjectStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status) {
    res.status(400);
    throw new Error('Le statut est requis.');
  }

  const project = await AltcomProject.findByIdAndUpdate(
    req.params.id,
    { status, updatedAt: Date.now() },
    { new: true, runValidators: true }
  );

  if (!project) {
    res.status(404);
    throw new Error('Projet non trouvé.');
  }

  console.log(`✅ [Altcom] Statut du projet ${project.projectName} mis à jour: ${status}`);

  res.status(200).json({
    status: 'success',
    message: 'Statut mis à jour avec succès',
    data: {
      project,
    },
  });
});

/**
 * @description Supprimer un projet (Admin)
 * @route DELETE /api/altcom/projects/:id
 * @access Protected (Admin)
 */
exports.deleteProject = asyncHandler(async (req, res) => {
  const project = await AltcomProject.findByIdAndDelete(req.params.id);

  if (!project) {
    res.status(404);
    throw new Error('Projet non trouvé.');
  }

  console.log(`✅ [Altcom] Projet supprimé: ${project.projectName}`);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});