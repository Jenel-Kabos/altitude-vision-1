/**
 * @fileoverview Contrôleur d'administration pour la gestion des utilisateurs, propriétés et statistiques.
 * Toutes les fonctions sont protégées via authMiddleware et réservées aux rôles 'Admin' ou 'Collaborateur'.
 */

const User = require('../models/User');
const Property = require('../models/Property');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const userKpiService = require('../services/userKpiService'); // USER-KPI-1
// SECURITY-CLOSURE-P0-WAVE-1 (P0-E, finding RA-09) — ce fichier duplique un
// flux de modération Property jamais aligné sur TENANT-CERT-2
// (propertyController.js) : `getAllProperties`/`getPendingProperties`
// n'appliquaient aucun filtre tenant, et `approveProperty`/`rejectProperty`/
// `deleteProperty` ne vérifiaient aucune frontière avant de muter/supprimer
// un Property par ObjectId arbitraire. Réutilise directement les mêmes
// primitives déjà canoniques (assertResourceTenantOrUnattributed +
// resolveTenantForUser), sans importer propertyController.js (éviterait un
// nouvel edge controller→controller suivi par architecture:check).
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const {
  guardUserViabilityMutation,
  assertNoPlatformOperatorForHardDelete,
  transitionOperatorForUserLifecycle,
} = require('../services/platformOperator/platformOperatorService');

async function assertAdminPropertyTenantAccess(req, res, property) {
  if (!req.platformTenant) return; // PlatformOperator en mode plateforme (allowPlatformWide) — aucun scope à imposer.
  try {
    await assertResourceTenantOrUnattributed({ resourceType: 'Property', resource: property, tenantId: req.platformTenant._id });
  } catch (error) {
    res.status(error.statusCode || 403);
    throw error;
  }
}

/* ============================================================
   📊 DASHBOARD ADMIN – STATISTIQUES GLOBALES
============================================================ */
exports.getDashboardStats = catchAsync(async (req, res) => {
    const tenantUserIds = req.platformTenant ? (req.tenantScopeUserIds || []) : null;
    const userFilter = tenantUserIds ? { _id: { $in: tenantUserIds } } : {};
    const propertyFilter = req.platformTenant ? { tenant: req.platformTenant._id } : {};
    const ownerIds = await userKpiService.getProprietaireUserIds();
    const scopedOwnerIds = tenantUserIds
      ? ownerIds.filter((id) => tenantUserIds.some((tenantUserId) => String(tenantUserId) === String(id)))
      : ownerIds;
    const [totalUsers, kpis, totalProperties, pendingProperties] = await Promise.all([
        User.countDocuments(userFilter),
        // USER-KPI-1 — remplace l'ancien `User.countDocuments({role:{$in:[...]}})`
        // (voir server/routes/dashboardRoutes.js pour la justification de la
        // règle d'union propriétaire immobilier + exploitant d'établissement).
        userKpiService.getUserKpiSummary(),
        Property.countDocuments(propertyFilter),
        Property.countDocuments({ ...propertyFilter, statusAdmin: 'En attente' }),
    ]);
    const totalOwners = req.platformTenant ? scopedOwnerIds.length : kpis.proprietaires;

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
    const ACTIVE_THRESHOLD = 5 * 60 * 1000;
    const activeSince = new Date(Date.now() - ACTIVE_THRESHOLD);

    const activeUsers = await User.find({
        isActive: true,
        lastActivityAt: { $gte: activeSince },
        _id: { $ne: req.user.id },
    }).select('name email role status lastActivityAt photo');

    res.status(200).json({
        status: 'success',
        results: activeUsers.length,
        data: { activeUsers },
    });
});

// 🔹 Bannir un utilisateur
exports.banUser = catchAsync(async (req, res, _next) => {
    const user = await guardUserViabilityMutation({ userId: req.params.id, operation: async (session) => {
        const query = User.findById(req.params.id);
        if (session) query.session(session);
        const target = await query;
        if (!target) throw new AppError('Utilisateur non trouvé.', 404);
        target.isActive = false;
        target.status = 'Banni';
        target.tokenVersion = (target.tokenVersion || 0) + 1;
        await target.save({ session, validateBeforeSave: false });
        await transitionOperatorForUserLifecycle({ userId: target._id, status: 'suspended', actor: req.user, reason: 'user_account_banned', session });
        return target;
    } });

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
    // USER-KPI-1 — remplace l'ancien `role:{$in:['Propriétaire','Proprietaire']}`
    // par la même règle d'union que getDashboardStats ci-dessus.
    const ownerIds = await userKpiService.getProprietaireUserIds();
    const owners = await User.find({
        _id: { $in: ownerIds }
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
    const lifecycleFields = ['isActive', 'status', 'tokenVersion'];
    if (lifecycleFields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field))) {
        return res.status(409).json({
            status: 'fail',
            code: 'ACCOUNT_LIFECYCLE_ENDPOINT_REQUIRED',
            message: 'Utilisez les opérations dédiées de suspension, bannissement ou réactivation.',
        });
    }
    const forbiddenFields = ['password', 'passwordConfirm', 'tokenInvalidatedAt', ...lifecycleFields];
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

// 🔹 Vérifier un utilisateur (KYC)
exports.verifyOwner = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('Utilisateur non trouvé.', 404));

    // ✅ isVerified = KYC validé (pas isEmailVerified qui est pour l'email)
    user.isVerified = true;
    user.status = 'Actif';

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        status: 'success',
        message: 'Utilisateur vérifié avec succès.',
        data: { user },
    });
});

// 🔹 Suspendre un utilisateur
exports.suspendUser = catchAsync(async (req, res, _next) => {
    const user = await guardUserViabilityMutation({ userId: req.params.id, operation: async (session) => {
        const query = User.findById(req.params.id);
        if (session) query.session(session);
        const target = await query;
        if (!target) throw new AppError('Utilisateur non trouvé.', 404);
        target.isActive = false;
        target.status = 'Suspendu';
        target.tokenVersion = (target.tokenVersion || 0) + 1;
        await target.save({ session, validateBeforeSave: false });
        await transitionOperatorForUserLifecycle({ userId: target._id, status: 'suspended', actor: req.user, reason: 'user_account_suspended', session });
        return target;
    } });

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
    user.status = 'Actif'; // ✅ Cohérent avec le frontend (était 'active' en minuscule)

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        status: 'success',
        message: 'Utilisateur réactivé avec succès.',
        data: { user },
    });
});

// 🔹 Supprimer un utilisateur et ses propriétés (Cascade)
exports.deleteUser = catchAsync(async (req, res, _next) => {
    if (String(req.params.id) === String(req.user?._id || req.user?.id)) {
        return res.status(403).json({ status: 'fail', message: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }
    await guardUserViabilityMutation({ userId: req.params.id, operation: async (session) => {
        const query = User.findById(req.params.id);
        if (session) query.session(session);
        const user = await query;
        if (!user) throw new AppError('Utilisateur non trouvé.', 404);
        await assertNoPlatformOperatorForHardDelete(user._id, session);
        await Property.deleteMany({ owner: user._id }, { session });
        await user.deleteOne({ session });
    } });

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
    const properties = await Property.find(req.platformTenant ? { tenant: req.platformTenant._id } : {})
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
    const properties = await Property.find({
        adminStatus: 'pending',
        ...(req.platformTenant ? { tenant: req.platformTenant._id } : {}),
    })
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
    await assertAdminPropertyTenantAccess(req, res, property);

    property.adminStatus = 'approved';
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
    await assertAdminPropertyTenantAccess(req, res, property);

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
    const property = await Property.findById(req.params.id);
    if (!property) return next(new AppError('Propriété non trouvée.', 404));
    await assertAdminPropertyTenantAccess(req, res, property);

    await Property.findByIdAndDelete(req.params.id);

    res.status(204).json({
        status: 'success',
        data: null,
    });
});

/* ============================================================
   🧾 RAPPORT D'ACTIVITÉ ADMIN
============================================================ */
exports.getActivityReport = catchAsync(async (req, res) => {
    const last30days = new Date();
    last30days.setDate(last30days.getDate() - 30);

    const tenantUserIds = req.platformTenant ? (req.tenantScopeUserIds || []) : null;
    const [newUsers, newProperties] = await Promise.all([
        User.countDocuments({
            createdAt: { $gte: last30days },
            ...(tenantUserIds ? { _id: { $in: tenantUserIds } } : {}),
        }),
        Property.countDocuments({
            createdAt: { $gte: last30days },
            ...(req.platformTenant ? { tenant: req.platformTenant._id } : {}),
        }),
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
