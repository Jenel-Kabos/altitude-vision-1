const Project = require('../models/Project');

// @desc    Récupérer tous les projets du portfolio
// @route   GET /api/projects
// @access  Public
const getProjects = async (req, res, next) => {
    try {
        const projects = await Project.find({});
        res.json(projects);
    } catch (error) {
        next(error);
    }
};

// @desc    Récupérer un projet par son ID
// @route   GET /api/projects/:id
// @access  Public
const getProjectById = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.id);
        if (project) {
            res.json(project);
        } else {
            res.status(404);
            throw new Error('Projet non trouvé');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    (Admin) Créer un nouveau projet pour le portfolio
// @route   POST /api/projects
// @access  Privé/Admin
const createProject = async (req, res, next) => {
    const { title, category, description, imageUrl } = req.body;

    try {
        const project = new Project({
            title,
            category,
            description,
            imageUrl,
        });

        const createdProject = await project.save();
        res.status(201).json(createdProject);
    } catch (error) {
        next(error);
    }
};

// @desc    (Admin) Mettre à jour un projet
// @route   PUT /api/projects/:id
// @access  Privé/Admin
const updateProject = async (req, res, next) => {
    const { title, category, description, imageUrl } = req.body;
    try {
        const project = await Project.findById(req.params.id);
        if (project) {
            project.title = title;
            project.category = category;
            project.description = description;
            project.imageUrl = imageUrl;

            const updatedProject = await project.save();
            res.json(updatedProject);
        } else {
            res.status(404);
            throw new Error('Projet non trouvé');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    (Admin) Supprimer un projet
// @route   DELETE /api/projects/:id
// @access  Privé/Admin
const deleteProject = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.id);
        if (project) {
            await project.remove();
            res.json({ message: 'Projet supprimé avec succès' });
        } else {
            res.status(404);
            throw new Error('Projet non trouvé');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Créer un nouvel avis sur un projet
// @route   POST /api/projects/:id/reviews
// @access  Privé (utilisateurs connectés)
const createProjectReview = async (req, res, next) => {
    const { rating, comment } = req.body;

    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            res.status(404);
            throw new Error('Projet non trouvé');
        }

        const alreadyReviewed = project.reviews.find(
            (r) => r.user.toString() === req.user._id.toString()
        );

        if (alreadyReviewed) {
            res.status(400);
            throw new Error('Vous avez déjà évalué ce projet.');
        }

        const review = {
            name: req.user.name,
            rating: Number(rating),
            comment,
            user: req.user._id,
        };

        project.reviews.push(review);
        project.numReviews = project.reviews.length;
        project.rating = project.reviews.reduce((acc, item) => item.rating + acc, 0) / project.reviews.length;

        await project.save();
        res.status(201).json({ message: 'Avis ajouté avec succès !' });

    } catch (error) {
        next(error);
    }
};

// Exporter toutes les fonctions
module.exports = { 
    getProjects, 
    getProjectById,
    createProject, 
    updateProject,
    deleteProject,
    createProjectReview 
};