// server/controllers/propertyController.js
const asyncHandler = require('express-async-handler');
const Property = require('../models/Property');
const User = require('../models/User'); 
const APIFeatures = require('../utils/apiFeatures');

// ============================================================
// 🛠️ UTILITAIRES
// ============================================================

/**
 * Nettoie le champ amenities (tableau ou string)
 */
const parseAmenities = (amenities) => {
    if (Array.isArray(amenities)) {
        return amenities.map(a => (typeof a === 'string' ? a.trim() : a)).filter(Boolean);
    }
    if (typeof amenities === 'string') {
        try {
            const parsed = JSON.parse(amenities);
            if (Array.isArray(parsed)) {
                return parsed.map(a => (typeof a === 'string' ? a.trim() : a)).filter(Boolean);
            }
        } catch (e) {
            return amenities.split(',').map(a => a.trim()).filter(Boolean);
        }
    }
    return [];
};

// ============================================================
// 🎮 CONTRÔLEURS PRINCIPAUX
// ============================================================

/**
 * @description Créer un bien immobilier
 * @route POST /api/properties
 */
const createProperty = asyncHandler(async (req, res, next) => {
    console.log("--- 🆕 Création de propriété ---");
    
    // 1. Gestion des images via Cloudinary
    const imagePaths = req.files ? req.files.map(file => file.path) : [];
    
    // 2. Préparation des données
    const { 
        title, description, price, pole, status, availability, type, 
        surface, bedrooms, bathrooms, amenities, 
        livingRooms, kitchens, constructionType, 
        longitude, latitude, address, location 
    } = req.body;
    
    // 3. Parsing de l'adresse
    let addressData = {};
    if (typeof address === 'string') {
        try { addressData = JSON.parse(address); } 
        catch (e) { addressData = address || {}; }
    } else {
        addressData = address || {};
    }

    const finalAddress = {
        district: addressData.district,
        street: addressData.street,
        city: addressData.city || 'Brazzaville' 
    };

    // 4. Parsing de la Location (GeoJSON)
    let finalLocation = undefined;
    if (location) {
        if (typeof location === 'string') {
            try { finalLocation = JSON.parse(location); } catch (e) {}
        } else {
            finalLocation = location;
        }
    }

    // 5. Création en base
    const newProperty = await Property.create({
        owner: req.user.id,
        title,
        description,
        price: parseFloat(price),
        pole,
        status,
        availability,
        type,
        address: finalAddress, 
        surface: parseFloat(surface),
        bedrooms: parseInt(bedrooms || 0),
        bathrooms: parseInt(bathrooms || 0),
        livingRooms: parseInt(livingRooms || 0),
        kitchens: parseInt(kitchens || 0),
        constructionType,
        amenities: parseAmenities(amenities),
        longitude, 
        latitude,
        location: finalLocation, 
        images: imagePaths,
        statusAdmin: 'En attente' // Par défaut
    });

    console.log(`✅ Propriété créée : ${newProperty._id}`);

    res.status(201).json({
        status: 'success',
        data: { property: newProperty },
    });
});

/**
 * @description Obtenir tous les biens (Public)
 * @route GET /api/properties
 */
const getAllProperties = asyncHandler(async (req, res) => {
    // Filtre de sécurité : Seul l'admin voit tout. Le public ne voit que "Validée".
    const isAdmin = req.user && req.user.role === 'Admin';
    
    if (!isAdmin) {
        req.query.statusAdmin = 'Validée';
    }

    const features = new APIFeatures(Property.find(), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const properties = await features.query;
    
    res.status(200).json({
        status: 'success',
        results: properties.length,
        data: { properties },
    });
});

/**
 * @description Obtenir les biens en attente (ADMIN)
 * @route GET /api/properties/status/pending
 */
const getPendingProperties = asyncHandler(async (req, res) => {
    console.log("📡 [Admin] Récupération des annonces en attente...");

    // On récupère tout ce qui est "En attente" ET on inclut les infos du propriétaire
    const properties = await Property.find({ statusAdmin: 'En attente' })
        .populate('owner', 'name email photo role phone') // ✅ CRUCIAL pour le Dashboard
        .sort('-createdAt'); // Les plus récentes en premier

    console.log(`✅ ${properties.length} annonces en attente.`);

    res.status(200).json({
        status: 'success',
        results: properties.length,
        data: { properties },
    });
});

/**
 * @description Middleware pour les dernières propriétés
 */
const getLatestProperties = (req, res, next) => {
    req.query.limit = '5';
    req.query.sort = '-createdAt';
    req.query.statusAdmin = 'Validée';
    next();
};

/**
 * @description Obtenir un bien par ID
 * @route GET /api/properties/:id
 */
const getProperty = asyncHandler(async (req, res) => {
    const property = await Property.findById(req.params.id).populate('owner', 'name email photo phone');

    if (!property) {
        res.status(404);
        throw new Error('Bien immobilier non trouvé.');
    }

    // Sécurité : Si non validée, seul l'admin ou le propriétaire peut voir
    const isAdmin = req.user && req.user.role === 'Admin';
    const isOwner = req.user && property.owner && property.owner._id.toString() === req.user.id.toString();
    
    if (property.statusAdmin !== 'Validée' && !isAdmin && !isOwner) {
        res.status(403);
        throw new Error('Cette propriété est en attente de validation.');
    }

    res.status(200).json({
        status: 'success',
        data: { property },
    });
});

/**
 * @description Obtenir les biens de l'utilisateur connecté
 * @route GET /api/properties/my-properties
 */
const getMyProperties = asyncHandler(async (req, res) => {
    const properties = await Property.find({ owner: req.user.id }).sort('-createdAt');

    res.status(200).json({
        status: 'success',
        results: properties.length,
        data: { properties },
    });
});

/**
 * @description Mettre à jour une propriété
 * @route PUT /api/properties/:id
 */
const updateProperty = asyncHandler(async (req, res) => {
    // La propriété est déjà chargée par le middleware checkPropertyOwnership dans req.property
    // Mais par sécurité/simplicité, on peut refaire un findById si nécessaire, 
    // ou utiliser req.property si ton middleware le fournit.
    
    // Champs interdits à la modification directe
    const excludedFields = ['_id', 'owner', 'createdAt', 'statusAdmin', 'reviewedAt', 'images'];
    const updateData = { ...req.body };
    excludedFields.forEach(field => delete updateData[field]);

    // Gestion des Images
    const newImages = req.files ? req.files.map(file => file.path) : [];
    let existingImages = req.body.existingImages || [];
    
    // Parsing existingImages si string
    if (typeof existingImages === 'string') {
        try { existingImages = JSON.parse(existingImages); } catch (e) { existingImages = [existingImages]; }
    }
    if (!Array.isArray(existingImages)) existingImages = [];

    // On combine si on a de nouvelles images ou des anciennes explicites
    if (newImages.length > 0 || existingImages.length > 0) {
        updateData.images = [...existingImages, ...newImages];
    }
    // Sinon, on ne touche pas au champ images (MongoDB gardera l'ancien)

    // Parsing Adresse
    if (typeof updateData.address === 'string') {
        try { updateData.address = JSON.parse(updateData.address); } catch (e) { delete updateData.address; }
    }

    // Parsing Location (GPS)
    if (updateData.longitude && updateData.latitude) {
        updateData.location = {
            type: 'Point',
            coordinates: [parseFloat(updateData.longitude), parseFloat(updateData.latitude)]
        };
    }

    // Mise à jour
    const updatedProperty = await Property.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        status: 'success',
        data: { property: updatedProperty },
    });
});

/**
 * @description Valider ou Rejeter une propriété (ADMIN)
 * @route PATCH /api/properties/:id/:action
 */
const updatePropertyStatus = asyncHandler(async (req, res) => {
    const { id, action } = req.params;
    let newStatusAdmin;

    if (action === 'validate') newStatusAdmin = 'Validée';
    else if (action === 'reject') newStatusAdmin = 'Rejetée';
    else {
        res.status(400);
        throw new Error('Action invalide (validate ou reject attendu).');
    }

    const updatedProperty = await Property.findByIdAndUpdate(
        id,
        { 
            statusAdmin: newStatusAdmin,
            reviewedAt: Date.now()
        },
        { new: true }
    );

    if (!updatedProperty) {
        res.status(404);
        throw new Error('Propriété non trouvée.');
    }

    res.status(200).json({
        status: 'success',
        message: `Propriété ${newStatusAdmin.toLowerCase()}.`,
        data: { property: updatedProperty },
    });
});

/**
 * @description Supprimer une propriété
 * @route DELETE /api/properties/:id
 */
const deleteProperty = asyncHandler(async (req, res) => {
    const property = await Property.findByIdAndDelete(req.params.id);
    if (!property) {
        res.status(404);
        throw new Error('Propriété non trouvée.');
    }
    res.status(204).json({ status: 'success', data: null });
});

/**
 * @description Supprimer une propriété (Admin)
 * @route DELETE /api/properties/admin/:id
 */
const adminDeleteProperty = asyncHandler(async (req, res) => {
    const property = await Property.findByIdAndDelete(req.params.id);
    if (!property) {
        res.status(404);
        throw new Error('Propriété non trouvée.');
    }
    res.status(204).json({ status: 'success', data: null });
});

// ============================================================
// 📤 EXPORTS UNIFIÉS (Évite les erreurs 500)
// ============================================================
module.exports = {
    createProperty,
    getAllProperties,
    getPendingProperties,
    getLatestProperties,
    getProperty,
    getMyProperties,
    updateProperty,
    updatePropertyStatus,
    deleteProperty,
    adminDeleteProperty
};