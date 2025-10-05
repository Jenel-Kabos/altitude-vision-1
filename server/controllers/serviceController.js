const Service = require('../models/Service');

// @desc    Récupérer tous les services
// @route   GET /api/services
// @access  Public
const getServices = async (req, res, next) => {
    try {
        const services = await Service.find({});
        res.json(services);
    } catch (error) {
        next(error);
    }
};

// @desc    (Admin) Créer un nouveau service
// @route   POST /api/services
// @access  Privé/Admin
const createService = async (req, res, next) => {
    const { name, description, category, basePrice, imageUrl, options } = req.body;
    
    try {
        const service = new Service({
            name,
            description,
            category,
            basePrice,
            imageUrl,
            options
        });

        const createdService = await service.save();
        res.status(201).json(createdService);
    } catch (error) {
        next(error);
    }
};


// VÉRIFIEZ BIEN QUE CETTE LIGNE EST CORRECTE ET COMPLÈTE
module.exports = { getServices, createService };