const Property = require('../models/Property');

// @desc    Récupérer les biens publiés
// @route   GET /api/properties
// @access  Public
const getProperties = async (req, res, next) => {
    try {
        // Ne renvoie que les propriétés qui ont été approuvées par un admin
        const properties = await Property.find({ isPublished: true }).populate('owner', 'name');
        res.json(properties);
    } catch (error) {
        next(error);
    }
};

// @desc    Récupérer un bien par son ID
// @route   GET /api/properties/:id
// @access  Public
const getPropertyById = async (req, res, next) => {
    try {
        const property = await Property.findById(req.params.id).populate('owner', 'name email');

        if (property) {
            res.json(property);
        } else {
            res.status(404);
            throw new Error('Bien immobilier non trouvé');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Créer un nouveau bien
// @route   POST /api/properties
// @access  Privé (utilisateurs connectés)
const createProperty = async (req, res, next) => {
    const { title, description, price, address, district, status } = req.body;

    try {
        const property = new Property({
            owner: req.user._id, // L'ID de l'utilisateur connecté
            title,
            description,
            price,
            address,
            district,
            status,
            images: [req.file.path] // Chemin du fichier uploadé par multer
        });

        const createdProperty = await property.save();
        res.status(201).json(createdProperty);
    } catch (error) {
        next(error);
    }
};

// @desc    Mettre à jour un bien
// @route   PUT /api/properties/:id
// @access  Privé (Propriétaire ou Admin)
const updateProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      res.status(404);
      throw new Error('Bien non trouvé');
    }

    // Vérification : l'utilisateur est-il le propriétaire ou un admin ?
    if (property.owner.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      res.status(401);
      throw new Error('Action non autorisée');
    }

    // Mettre à jour les champs fournis dans la requête
    property.title = req.body.title || property.title;
    property.description = req.body.description || property.description;
    property.price = req.body.price || property.price;
    property.address = req.body.address || property.address;
    property.district = req.body.district || property.district;
    property.status = req.body.status || property.status;

    const updatedProperty = await property.save();
    res.json(updatedProperty);

  } catch (error) {
    next(error);
  }
};

// @desc    Supprimer un bien
// @route   DELETE /api/properties/:id
// @access  Privé (Propriétaire ou Admin)
const deleteProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      res.status(404);
      throw new Error('Bien non trouvé');
    }
    
    // Même vérification d'autorisation
    if (property.owner.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      res.status(401);
      throw new Error('Action non autorisée');
    }

    await property.remove();
    res.json({ message: 'Bien immobilier supprimé' });

  } catch (error) {
    next(error);
  }
};

// @desc    (Admin) Récupérer TOUS les biens, publiés ou non
// @route   GET /api/properties/admin/all
// @access  Privé/Admin
const getAllPropertiesForAdmin = async (req, res, next) => {
    try {
        const properties = await Property.find({}).populate('owner', 'name');
        res.json(properties);
    } catch (error) {
        next(error);
    }
};

// @desc    (Admin) Approuver un bien pour le publier
// @route   PUT /api/properties/:id/approve
// @access  Privé/Admin
const approveProperty = async (req, res, next) => {
    try {
        const property = await Property.findById(req.params.id);

        if (property) {
            property.isPublished = true;
            const updatedProperty = await property.save();
            res.json(updatedProperty);
        } else {
            res.status(404);
            throw new Error('Bien non trouvé');
        }
    } catch (error) {
        next(error);
    }
};

// Exporter toutes les fonctions pour les utiliser dans les routes
module.exports = { 
  getProperties, 
  getPropertyById,
  createProperty, 
  updateProperty, 
  deleteProperty,
  getAllPropertiesForAdmin,
  approveProperty
};