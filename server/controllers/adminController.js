/**
 * @fileoverview Contrôleur d’administration pour la gestion des utilisateurs, propriétés et statistiques.
 * Toutes les fonctions sont protégées via authMiddleware et réservées aux rôles 'Admin' ou 'Collaborateur'.
 */

const User = require('../models/User');
const Property = require('../models/Property');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/* ============================================================
   📊 DASHBOARD ADMIN – STATISTIQUES GLOBALES
============================================================ */
exports.getDashboardStats = catchAsync(async (req, res) => {
    // Exécution en parallèle pour la performance
    const [totalUsers, totalOwners, totalProperties, pendingProperties] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: { $in: ['Propriétaire', 'Proprietaire'] } }), // Gère les deux orthographes
        Property.countDocuments(),
        Property.countDocuments({ adminStatus: 'pending' }),
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            totalUsers,
            totalOwners,
            totalProperties,
            pendingProperties,
        },
    });
});

/* ============================================================
   👥 GESTION DES UTILISATEURS
============================================================ */

// 🔹 Liste des utilisateurs actifs récemment
exports.getConnectedUsers = catchAsync(async (req, res) => {
    const ACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    const activeSince = new Date(Date.now() - ACTIVE_THRESHOLD);

    const activeUsers = await User.find({
        isActive: true,
        lastActivityAt: { $gte: activeSince },
        _id: { $ne: req.user.id }, // Exclure l'admin actuel
    }).select('name email role status lastActivityAt photo');

    res.status(200).json({
        status: 'success',
        results: activeUsers.length,
        data: { activeUsers },
    });
});

// 🔹 Bannir un utilisateur (Désactivation + Invalidation Token)
exports.banUser = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('Utilisateur non trouvé.', 404));

    // Logique de bannissement
    user.isActive = false;
    user.status = 'banned'; // Si tu as un champ status
    // On invalide le token pour forcer la déconnexion immédiate
    user.tokenVersion = (user.tokenVersion || 0) + 1; 
    
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        status: 'success',
        message: 'Utilisateur banni et déconnecté de force.',
        data: { user },
    });
});

// 🔹 Liste de tous les utilisateurs
exports.getAllUsers = catchAsync(async (req, res) => {
    const users = await User.find().select('-password').sort('-createdAt');
    res.status(200).json({
        status: 'success',
        results: users.length,
        data: { users },
    });
});

// 🔹 Liste de tous les propriétaires
exports.getAllOwners = catchAsync(async (req, res) => {
    const owners = await User.find({ 
        role: { $in: ['Propriétaire', 'Proprietaire'] } 
    }).select('-password').sort('-createdAt');

    res.status(200).json({
        status: 'success',
        results: owners.length,
        data: { owners },
    });
});

// 🔹 Voir un utilisateur spécifique
exports.getUser = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return next(new AppError('Utilisateur non trouvé.', 404));

    res.status(200).json({
        status: 'success',
        data: { user },
    });
});

// 🔹 Modifier un utilisateur spécifique
exports.updateUser = catchAsync(async (req, res, next) => {
    // Champs interdits à la modification directe via cette route
    const forbiddenFields = ['password', 'passwordConfirm', 'tokenInvalidatedAt'];
    const filteredBody = {};

    Object.keys(req.body).forEach((key) => {
        if (!forbiddenFields.includes(key)) filteredBody[key] = req.body[key];
    });

    const user = await User.findByIdAndUpdate(req.params.id, filteredBody, {
        new: true,
        runValidators: true,
    }).select('-password');

    if (!user) return next(new AppError('Utilisateur non trouvé.', 404));

    res.status(200).json({
        status: 'success',
        message: 'Utilisateur mis à jour avec succès.',
        data: { user },
    });
});

// 🔹 Vérifier un propriétaire
exports.verifyOwner = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) return next(new AppError('Utilisateur non trouvé.', 404));

    // Vérification souple du rôle (avec ou sans accent)
    if (!['Propriétaire', 'Proprietaire'].includes(user.role)) {
        return next(new AppError('Cet utilisateur n’est pas un propriétaire.', 400));
    }

    user.isEmailVerified = true; // Ou user.isVerified selon ton modèle
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        status: 'success',
        message: 'Propriétaire vérifié avec succès.',
        data: { user },
    });
});

// 🔹 Suspendre un utilisateur
exports.suspendUser = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('Utilisateur non trouvé.', 404));

    user.isActive = false;
    // On invalide aussi la session
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        status: 'success',
        message: 'Utilisateur suspendu avec succès.',
        data: { user },
    });
});

// 🔹 Réactiver un utilisateur
exports.activateUser = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('Utilisateur non trouvé.', 404));

    user.isActive = true;
    user.status = 'active'; // Reset du status si nécessaire
    
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        status: 'success',
        message: 'Utilisateur réactivé avec succès.',
        data: { user },
    });
});

// 🔹 Supprimer un utilisateur et ses propriétés (Cascade)
exports.deleteUser = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('Utilisateur non trouvé.', 404));

    // Suppression en cascade des propriétés
    await Property.deleteMany({ owner: user._id });
    
    // Suppression de l'utilisateur
    await user.deleteOne();

    res.status(204).json({
        status: 'success',
        data: null,
    });
});

/* ============================================================
   🏠 GESTION DES PROPRIÉTÉS
============================================================ */

// 🔹 Récupérer toutes les propriétés
exports.getAllProperties = catchAsync(async (req, res) => {
    const properties = await Property.find()
        .populate('owner', 'name email photo phone')
        .sort('-createdAt');

    res.status(200).json({
        status: 'success',
        results: properties.length,
        data: { properties },
    });
});

// 🔹 Récupérer les propriétés en attente
exports.getPendingProperties = catchAsync(async (req, res) => {
    const properties = await Property.find({ adminStatus: 'pending' })
        .populate('owner', 'name email photo phone')
        .sort('-createdAt');

    res.status(200).json({
        status: 'success',
        results: properties.length,
        data: { properties },
    });
});

// 🔹 Approuver une propriété
exports.approveProperty = catchAsync(async (req, res, next) => {
    const property = await Property.findById(req.params.id);
    if (!property) return next(new AppError('Propriété non trouvée.', 404));

    property.adminStatus = 'approved';
    // property.status = 'available'; // Optionnel : rendre dispo immédiatement
    
    await property.save({ validateBeforeSave: false });

    res.status(200).json({
        status: 'success',
        message: 'Propriété approuvée avec succès.',
        data: { property },
    });
});

// 🔹 Rejeter une propriété
exports.rejectProperty = catchAsync(async (req, res, next) => {
    const property = await Property.findById(req.params.id);
    if (!property) return next(new AppError('Propriété non trouvée.', 404));

    property.adminStatus = 'rejected';
    await property.save({ validateBeforeSave: false });

    res.status(200).json({
        status: 'success',
        message: 'Propriété rejetée.',
        data: { property },
    });
});

// 🔹 Supprimer une propriété
exports.deleteProperty = catchAsync(async (req, res, next) => {
    const property = await Property.findByIdAndDelete(req.params.id);
    
    if (!property) return next(new AppError('Propriété non trouvée.', 404));

    res.status(204).json({
        status: 'success',
        data: null,
    });
});

/* ============================================================
   🧾 RAPPORT D’ACTIVITÉ ADMIN
============================================================ */
exports.getActivityReport = catchAsync(async (req, res) => {
    const last30days = new Date();
    last30days.setDate(last30days.getDate() - 30);

    const [newUsers, newProperties] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: last30days } }),
        Property.countDocuments({ createdAt: { $gte: last30days } }),
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            newUsers,
            newProperties,
            period: {
                from: last30days,
                to: new Date(),
            }
        },
    });
});