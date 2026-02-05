const asyncHandler = require('express-async-handler');
const Property = require('../models/Property');
const User = require('../models/User'); 
const APIFeatures = require('../utils/apiFeatures');

/**
 * @description Analyse et nettoie le champ "amenities".
 * Gère les tableaux natifs, les chaînes JSON sérialisées (FormData) 
 * et les chaînes séparées par des virgules.
 * @param {string | string[]} amenities Le champ amenities reçu du req.body
 * @returns {string[]} Un tableau propre de chaînes de caractères
 */
const parseAmenities = (amenities) => {
    if (Array.isArray(amenities)) {
        // C'est déjà un tableau, on le nettoie juste
        return amenities.map(a => (typeof a === 'string' ? a.trim() : a)).filter(Boolean);
    }

    if (typeof amenities === 'string') {
        try {
            // Tentative 1: Tenter de parser la chaîne comme du JSON (pour FormData)
            const parsed = JSON.parse(amenities);
            if (Array.isArray(parsed)) {
                return parsed.map(a => (typeof a === 'string' ? a.trim() : a)).filter(Boolean);
            }
        } catch (e) {
            // Tentative 2: Revenir à une séparation par virgules si le parsing JSON échoue
            return amenities.split(',').map(a => a.trim()).filter(Boolean);
        }
    }

    return [];
};

// --- FONCTIONS DE BASE ---

/**
 * @description Créer un bien immobilier (Owner/User route)
 * @route POST /api/properties
 * @access Protected (Admin ou Proprietaire)
 */
exports.createProperty = asyncHandler(async (req, res, next) => {
    
    console.log("--- 🆕 Début de createProperty ---");
    console.log("📁 Multer finished. req.files:", req.files); 
    console.log("📦 Multer finished. req.body:", req.body);
    console.log("👤 User:", req.user ? `${req.user.id} (${req.user.role})` : 'Non défini');
    console.log("-------------------------------");
    
    // 1. Gérer les images (✅ MODIFICATION CLOUDINARY)
    // Cloudinary renvoie l'URL complète dans 'file.path'
    const imagePaths = req.files 
        ? req.files.map(file => file.path) 
        : [];
    
    console.log("🖼️ Images uploadées (Cloudinary):", imagePaths);
    
    // 2. Préparer les données
    const { 
        title, description, price, pole, status, availability, type, 
        surface, bedrooms, bathrooms, amenities, 
        // 🆕 Extraction des nouveaux champs
        livingRooms, kitchens, constructionType, 
        longitude, latitude, 
        address, 
        location 
    } = req.body;
    
    // Gestion de l'adresse (maintenant envoyée en JSON string depuis le client)
    let addressData = {};
    if (typeof address === 'string') {
        try {
            addressData = JSON.parse(address);
            console.log("📍 Adresse parsée:", addressData);
        } catch (e) {
            console.error("❌ Erreur de parsing JSON pour l'adresse:", e);
            addressData = address || {};
        }
    } else {
        addressData = address || {};
    }

    const finalAddress = {
        district: addressData.district,
        street: addressData.street,
        city: addressData.city || 'Brazzaville' 
    };

    // Gestion de la localisation GeoJSON (maintenant envoyée en JSON string)
    let finalLocation = undefined;
    
    if (location && typeof location === 'string') {
        try { 
            finalLocation = JSON.parse(location);
            console.log("🗺️ Location parsée:", finalLocation);
        } catch (e) {
            console.error("❌ Erreur de parsing GeoJSON location:", e);
        }
    } else if (location && typeof location === 'object') {
        finalLocation = location;
    }

    // 3. Gérer les équipements (amenities) avec le helper
    const amenitiesArray = parseAmenities(amenities);
    console.log("✨ Amenities parsées:", amenitiesArray);

    // 4. Création de la propriété
    const newProperty = await Property.create({
        owner: req.user.id,
        title,
        description,
        price: parseFloat(price), // Assurer le type Number
        pole,
        status,
        availability,
        type,
        address: finalAddress, 
        surface: parseFloat(surface), // Assurer le type Number
        bedrooms: parseInt(bedrooms), // Assurer le type Number
        bathrooms: parseInt(bathrooms), // Assurer le type Number
        // 🆕 Ajout des nouveaux champs
        livingRooms: parseInt(livingRooms),
        kitchens: parseInt(kitchens),
        constructionType,
        amenities: amenitiesArray,
        longitude: longitude, 
        latitude: latitude,
        location: finalLocation, 
        images: imagePaths,
    });

    console.log("✅ Propriété créée avec succès:", newProperty._id);

    res.status(201).json({
        status: 'success',
        data: {
            property: newProperty,
        },
    });
});

/**
 * @description Obtenir tous les biens avec filtres, tri, pagination
 * @route GET /api/properties
 * @access Public (avec optionalAuth)
 */
exports.getAllProperties = asyncHandler(async (req, res) => {
    console.log("📡 [getAllProperties] Query reçue:", req.query);
    console.log("👤 [getAllProperties] User:", req.user ? `${req.user.id} (${req.user.role})` : 'Non authentifié');
    
    // ⭐ Filtrer seulement les propriétés validées pour les non-admins
    const isAdmin = req.user && req.user.role === 'Admin';
    
    if (!isAdmin) {
        req.query.statusAdmin = 'Validée';
        console.log("🔒 [getAllProperties] Filtre public activé : statusAdmin = Validée");
    } else {
        console.log("🔓 [getAllProperties] Mode Admin : toutes les propriétés visibles");
    }
    
    // Construction de la requête MongoDB avec APIFeatures
    const features = new APIFeatures(Property.find(), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const properties = await features.query;
    
    console.log(`✅ [getAllProperties] ${properties.length} propriété(s) trouvée(s)`);
    
    res.status(200).json({
        status: 'success',
        results: properties.length,
        data: {
            properties,
        },
    });
});

// --- NOUVELLE FONCTION AJOUTÉE POUR CORRIGER L'ERREUR DE ROUTE ---
/**
 * @description Obtenir les biens en attente de validation (Admin)
 * @route GET /api/admin/properties/status/pending
 * @access Protected (Admin)
 */
exports.getPendingProperties = asyncHandler(async (req, res) => {
    console.log("📡 [getPendingProperties] Récupération des propriétés en attente...");
    
    // Note: L'accès à cette fonction doit être protégé par le middleware restrictTo('Admin').
    const properties = await Property.find({ statusAdmin: 'En attente' });

    console.log(`✅ [getPendingProperties] ${properties.length} propriété(s) en attente trouvée(s)`);

    res.status(200).json({
        status: 'success',
        results: properties.length,
        data: {
            properties,
        },
    });
});
// -----------------------------------------------------------------

/**
 * @description Middleware pour obtenir les biens les plus récents
 * Modifie req.query puis passe au contrôleur getAllProperties
 * @route GET /api/properties/latest
 * @access Public
 */
exports.getLatestProperties = (req, res, next) => {
    console.log("🔧 [getLatestProperties] Query avant:", req.query);
    
    req.query.limit = req.query.limit || '5';
    req.query.sort = '-createdAt';
    req.query.statusAdmin = 'Validée';
    
    console.log("🔧 [getLatestProperties] Query après:", req.query);
    
    next();
};

/**
 * @description Obtenir un seul bien par ID
 * @route GET /api/properties/:id
 * @access Public (avec optionalAuth)
 */
exports.getProperty = asyncHandler(async (req, res, next) => {
    console.log(`📡 [getProperty] ID: ${req.params.id}`);
    console.log(`👤 [getProperty] User:`, req.user ? `${req.user.id} (${req.user.role})` : 'Non authentifié');
    
    const property = await Property.findById(req.params.id).populate('owner', 'name email');

    if (!property) {
        console.log(`❌ [getProperty] Propriété non trouvée: ${req.params.id}`);
        res.status(404);
        return res.json({ message: 'Bien immobilier non trouvé.' });
    }

    // Vérifier le statut de validation
    const isAdmin = req.user && req.user.role === 'Admin';
    const isOwner = req.user && property.owner._id.toString() === req.user.id.toString();
    
    console.log(`🔍 [getProperty] Vérifications:`, {
        statusAdmin: property.statusAdmin,
        isAdmin,
        isOwner
    });
    
    if (property.statusAdmin !== 'Validée' && !isAdmin && !isOwner) {
        console.log(`🔒 [getProperty] Propriété non validée et utilisateur non autorisé`);
        res.status(403);
        return res.json({ 
            message: 'Cette propriété est en attente de validation.',
            statusAdmin: property.statusAdmin 
        });
    }

    console.log(`✅ [getProperty] Propriété trouvée: ${property.title}`);
    
    res.status(200).json({
        status: 'success',
        data: {
            property,
        },
    });
});

/**
 * @description Obtenir les biens de l'utilisateur connecté
 * @route GET /api/properties/my-properties
 * @access Protected (Proprietaire ou Admin)
 */
exports.getMyProperties = asyncHandler(async (req, res) => {
    console.log(`📡 [getMyProperties] User: ${req.user.id} (${req.user.role})`);
    
    if (!req.user) {
        console.log(`❌ [getMyProperties] Utilisateur non défini`);
        res.status(401);
        return res.json({ message: 'Non autorisé. Utilisateur non défini.' });
    }

    const properties = await Property.find({ owner: req.user.id });

    console.log(`✅ [getMyProperties] ${properties.length} propriété(s) trouvée(s)`);

    res.status(200).json({
        status: 'success',
        results: properties.length,
        data: {
            properties,
        },
    });
});

/**
 * @description Mettre à jour un bien immobilier
 * @route PUT /api/properties/:id
 * @access Protected (Admin ou Proprietaire)
 */
exports.updateProperty = asyncHandler(async (req, res, next) => {
    console.log("--- 🔄 Début de updateProperty ---");
    console.log("📌 Property ID:", req.params.id);
    console.log("👤 User:", req.user ? `${req.user.id} (${req.user.role})` : 'Non défini');
    console.log("📦 Body reçu:", JSON.stringify(req.body, null, 2));
    console.log("📁 Nouveaux fichiers:", req.files ? req.files.length : 0);
    
    try {
        // 1. Utiliser la propriété déjà chargée par le middleware checkPropertyOwnership
        const property = req.property || await Property.findById(req.params.id);
        
        if (!property) {
            console.log(`❌ [updateProperty] Propriété non trouvée: ${req.params.id}`);
            res.status(404);
            throw new Error('Bien immobilier non trouvé.');
        }

        console.log("✅ [updateProperty] Propriété trouvée:", property.title);
        console.log("🖼️ [updateProperty] Images actuelles de la propriété:", property.images);

        // 2. Les permissions ont déjà été vérifiées par checkPropertyOwnership
        console.log("✅ [updateProperty] Permissions vérifiées par le middleware");

        // 3. ⭐ FILTRER LES CHAMPS NON MODIFIABLES
        const excludedFields = [
            '_id', '__v', 'owner', 'createdAt', 'updatedAt', 
            'statusAdmin', 'reviewedAt', 'id', 'existingImages', 
            'location' // Géré séparément
        ];
        
        // Créer un objet propre sans les champs interdits
        let updateData = {};
        Object.keys(req.body).forEach(key => {
            if (!excludedFields.includes(key)) {
                updateData[key] = req.body[key];
            }
        });
        
        console.log("🧹 [updateProperty] Champs exclus supprimés");
        
        // 4. Gérer les nouvelles images uploadées (✅ MODIFICATION CLOUDINARY)
        const newImages = req.files 
            ? req.files.map(file => file.path) // Utilisation de .path pour l'URL Cloudinary
            : [];

        console.log("🖼️ [updateProperty] Nouvelles images uploadées (Cloudinary):", newImages);

        // 5. Gérer les images existantes à conserver
        let existingImagesToKeep = [];
        
        if (req.body.existingImages) {
            console.log("🔍 [updateProperty] existingImages brut:", req.body.existingImages);
            console.log("🔍 [updateProperty] Type:", typeof req.body.existingImages);
            
            // Cas 1: C'est déjà un tableau (rare avec FormData)
            if (Array.isArray(req.body.existingImages)) {
                existingImagesToKeep = req.body.existingImages;
            } 
            // Cas 2: C'est une string JSON (cas le plus courant avec FormData)
            else if (typeof req.body.existingImages === 'string') {
                try {
                    const parsed = JSON.parse(req.body.existingImages);
                    existingImagesToKeep = Array.isArray(parsed) ? parsed : [parsed];
                } catch (e) {
                    console.error("⚠️ [updateProperty] Erreur parsing existingImages:", e);
                    // Si le parsing échoue, traiter comme une seule image
                    existingImagesToKeep = [req.body.existingImages];
                }
            }
            
            console.log("✅ [updateProperty] Images existantes à conserver:", existingImagesToKeep);
        }

        // 6. Combiner images existantes + nouvelles images
        if (existingImagesToKeep.length > 0 || newImages.length > 0) {
            updateData.images = [...existingImagesToKeep, ...newImages];
            console.log("🖼️ [updateProperty] Images finales combinées:", updateData.images);
        } else {
            // Si aucune image (ni existante ni nouvelle), on garde les images actuelles
            console.log("⚠️ [updateProperty] Aucune image fournie, conservation des images actuelles");
            delete updateData.images; // Ne pas toucher aux images
        }

        // 7. Gérer les coordonnées GPS et créer l'objet GeoJSON
        if (updateData.longitude && updateData.latitude) {
            const longitude = parseFloat(updateData.longitude);
            const latitude = parseFloat(updateData.latitude);
            
            if (!isNaN(longitude) && !isNaN(latitude)) {
                updateData.location = {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                };
                console.log("🗺️ [updateProperty] Location GeoJSON créée:", updateData.location);
                
                // Supprimer les champs individuels
                delete updateData.longitude;
                delete updateData.latitude;
            } else {
                console.log("⚠️ [updateProperty] Coordonnées GPS invalides, suppression");
                delete updateData.longitude;
                delete updateData.latitude;
            }
        } else if (updateData.longitude || updateData.latitude) {
            // Si une seule coordonnée est présente, on supprime tout
            console.log("⚠️ [updateProperty] Coordonnées GPS incomplètes, suppression");
            delete updateData.longitude;
            delete updateData.latitude;
        }

        // 8. Gérer les amenities
        if (updateData.amenities !== undefined) {
            if (updateData.amenities === '' || updateData.amenities === null) {
                updateData.amenities = [];
            } else {
                updateData.amenities = parseAmenities(updateData.amenities);
            }
            console.log("✨ [updateProperty] Amenities parsées:", updateData.amenities);
        }
        
        // 9. Gérer l'adresse
        if (updateData.address) {
            if (typeof updateData.address === 'string') {
                try {
                    const parsedAddress = JSON.parse(updateData.address);
                    if (parsedAddress.district || parsedAddress.street || parsedAddress.city) {
                        updateData.address = {
                            district: parsedAddress.district || '',
                            street: parsedAddress.street || '',
                            city: parsedAddress.city || 'Brazzaville'
                        };
                        console.log("📍 [updateProperty] Adresse parsée:", updateData.address);
                    } else {
                        delete updateData.address;
                    }
                } catch (e) {
                    console.log("⚠️ [updateProperty] Erreur parsing adresse, suppression");
                    delete updateData.address;
                }
            }
            // Si c'est déjà un objet, on le garde tel quel
        }

        // 10. Convertir les types numériques (Ajout des nouveaux champs)
        if (updateData.price) updateData.price = parseFloat(updateData.price);
        if (updateData.surface) updateData.surface = parseFloat(updateData.surface);
        if (updateData.bedrooms) updateData.bedrooms = parseInt(updateData.bedrooms);
        if (updateData.bathrooms) updateData.bathrooms = parseInt(updateData.bathrooms);
        if (updateData.livingRooms) updateData.livingRooms = parseInt(updateData.livingRooms);
        if (updateData.kitchens) updateData.kitchens = parseInt(updateData.kitchens);

        // 11. Convertir les booléens
        if (updateData.isPublished === 'true') updateData.isPublished = true;
        if (updateData.isPublished === 'false') updateData.isPublished = false;
        if (updateData.hasSpecialCommission === 'true') updateData.hasSpecialCommission = true;
        if (updateData.hasSpecialCommission === 'false') updateData.hasSpecialCommission = false;

        console.log("📝 [updateProperty] Données finales pour la mise à jour:", JSON.stringify(updateData, null, 2));

        // 12. Exécuter la mise à jour
        const updatedProperty = await Property.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            {
                new: true,
                runValidators: true,
            }
        );

        if (!updatedProperty) {
            console.log(`❌ [updateProperty] Erreur lors de la mise à jour`);
            res.status(500);
            throw new Error('Erreur lors de la mise à jour de la propriété');
        }

        console.log(`✅ [updateProperty] Propriété mise à jour avec succès: ${updatedProperty.title}`);
        console.log(`🖼️ [updateProperty] Images finales dans la BD:`, updatedProperty.images);

        res.status(200).json({
            status: 'success',
            data: {
                property: updatedProperty,
            },
        });

    } catch (error) {
        console.error("💥 [updateProperty] Erreur:", error.message);
        console.error("   Stack:", error.stack);
        
        // Gestion des erreurs spécifiques
        if (error.name === 'ValidationError') {
            res.status(400);
            throw new Error(`Validation échouée: ${error.message}`);
        }
        
        if (error.name === 'CastError') {
            res.status(400);
            throw new Error('ID de propriété invalide ou données de type incorrect');
        }
        
        throw error;
    }
});

// --- NOUVELLE FONCTION AJOUTÉE POUR LA GESTION ADMIN ---
/**
 * @description Mettre à jour le statut (Validation/Rejet) d'un bien (Admin)
 * @route PATCH /api/admin/properties/:id/:action(validate|reject)
 * @access Protected (Admin)
 */
exports.updatePropertyStatus = asyncHandler(async (req, res, next) => {
    const { id, action } = req.params;
    let newStatusAdmin;

    if (action === 'validate') {
        newStatusAdmin = 'Validée';
    } else if (action === 'reject') {
        newStatusAdmin = 'Rejetée';
    } else {
        res.status(400);
        throw new Error('Action de statut invalide.');
    }

    const updatedProperty = await Property.findByIdAndUpdate(
        id,
        { 
            statusAdmin: newStatusAdmin,
            reviewedAt: Date.now()
        },
        { new: true, runValidators: true }
    );

    if (!updatedProperty) {
        res.status(404);
        throw new Error('Bien immobilier non trouvé.');
    }

    console.log(`✅ [updatePropertyStatus] Propriété ${updatedProperty.title} est maintenant ${newStatusAdmin}.`);

    res.status(200).json({
        status: 'success',
        message: `Propriété ${newStatusAdmin.toLowerCase()} avec succès.`,
        data: {
            property: updatedProperty,
        },
    });
});
// --------------------------------------------------------

/**
 * @description Supprimer un bien immobilier (route utilisateur)
 * @route DELETE /api/properties/:id
 * @access Protected (Admin ou Proprietaire)
 */
exports.deleteProperty = asyncHandler(async (req, res, next) => {
    console.log(`📡 [deleteProperty] ID: ${req.params.id}`);
    console.log(`👤 [deleteProperty] User: ${req.user.id} (${req.user.role})`);
    
    // Utiliser la propriété déjà chargée par checkPropertyOwnership
    const property = req.property || await Property.findById(req.params.id);

    if (!property) {
        console.log(`❌ [deleteProperty] Propriété non trouvée`);
        res.status(404);
        return res.json({ message: 'Bien immobilier non trouvé.' });
    }

    // Les permissions ont déjà été vérifiées par checkPropertyOwnership
    console.log("✅ [deleteProperty] Permissions vérifiées par le middleware");

    await Property.findByIdAndDelete(req.params.id);

    console.log(`✅ [deleteProperty] Propriété supprimée: ${property.title}`);

    res.status(204).json({
        status: 'success',
        data: null,
    });
});

/**
 * @description Supprimer un bien immobilier (route Admin)
 * @route DELETE /api/properties/admin/:id
 * @access Protected (Admin)
 */
exports.adminDeleteProperty = asyncHandler(async (req, res, next) => {
    console.log(`📡 [adminDeleteProperty] ID: ${req.params.id}`);
    console.log(`👤 [adminDeleteProperty] User: ${req.user.id} (${req.user.role})`);
    
    const property = await Property.findByIdAndDelete(req.params.id);

    if (!property) {
        console.log(`❌ [adminDeleteProperty] Propriété non trouvée`);
        res.status(404);
        return res.json({ message: 'Bien immobilier non trouvé.' });
    }
    
    console.log(`✅ [adminDeleteProperty] Propriété supprimée: ${property.title}`);
    
    res.status(204).json({
        status: 'success',
        data: null,
    });
});

// ⭐ EXPORTS FINAUX
module.exports = {
    createProperty: exports.createProperty,
    getAllProperties: exports.getAllProperties,
    getPendingProperties: exports.getPendingProperties,
    getLatestProperties: exports.getLatestProperties,
    getProperty: exports.getProperty,
    getMyProperties: exports.getMyProperties,
    updateProperty: exports.updateProperty,
    updatePropertyStatus: exports.updatePropertyStatus,
    deleteProperty: exports.deleteProperty,
    adminDeleteProperty: exports.adminDeleteProperty
};