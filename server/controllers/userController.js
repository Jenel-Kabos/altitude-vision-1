// server/controllers/userController.js
const User = require('../models/User');
const { destroyFromCloudinary } = require('../config/cloudinary');

// ======================================================
// 🧭 UTILITAIRE : Récupère l'ID de l'utilisateur connecté
// ======================================================
exports.getMe = (req, res, next) => {
    req.params.id = req.user.id;
    next();
};

// ======================================================
// 👑 ADMIN : Récupérer tous les utilisateurs
// ======================================================
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json({ status: 'success', results: users.length, data: { users } });
    } catch (error) {
        console.error('Erreur getAllUsers:', error);
        res.status(500).json({ status: 'error', message: 'Erreur serveur lors de la récupération des utilisateurs.' });
    }
};

// ======================================================
// 👑 ADMIN : Récupérer tous les propriétaires
// ======================================================
exports.getAllOwners = async (req, res) => {
    try {
        const owners = await User.find({ role: 'Proprietaire' }).select('-password');
        res.status(200).json({ status: 'success', results: owners.length, data: { owners } });
    } catch (error) {
        console.error('Erreur getAllOwners:', error);
        res.status(500).json({ status: 'error', message: 'Erreur serveur lors de la récupération des propriétaires.' });
    }
};

// ======================================================
// 🔍 Récupérer un utilisateur par ID (Admin + getMe)
// ======================================================
exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Aucun utilisateur trouvé avec cet ID.' });
        }
        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        console.error('Erreur getUser:', error);
        res.status(500).json({ status: 'error', message: "Erreur serveur lors de la récupération de l'utilisateur." });
    }
};

// ======================================================
// ✏️ ADMIN : Mettre à jour un utilisateur (name, email, role)
// ======================================================
exports.updateUser = async (req, res) => {
    try {
        const allowedFields = ['name', 'email', 'role'];
        const updates = {};
        Object.keys(req.body).forEach(key => {
            if (allowedFields.includes(key)) updates[key] = req.body[key];
        });

        const user = await User.findByIdAndUpdate(req.params.id, updates, {
            new:           true,
            runValidators: true,
            select:        '-password',
        });

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        }

        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        console.error('Erreur updateUser:', error);
        res.status(500).json({ status: 'error', message: "Erreur serveur lors de la mise à jour de l'utilisateur." });
    }
};

// ======================================================
// ✅ ADMIN : Vérifier un propriétaire (KYC)
// ======================================================
exports.verifyOwner = async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isVerified: true, status: 'Actif' },
            { new: true, select: '-password' }
        );
        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        res.status(200).json({ status: 'success', message: '✅ Propriétaire vérifié avec succès.', data: { user } });
    } catch (error) {
        console.error('Erreur verifyOwner:', error);
        next(error);
    }
};

// ======================================================
// ⚠️ ADMIN : Suspendre un utilisateur
// 🔧 Utilise la méthode suspend() du modèle (invalide les sessions)
// ======================================================
exports.suspendUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

        await user.suspend(); // invalide tokenVersion → déconnecte immédiatement

        const updated = await User.findById(req.params.id).select('-password');
        res.status(200).json({ status: 'success', message: '⚠️ Compte suspendu avec succès.', data: { user: updated } });
    } catch (error) {
        console.error('Erreur suspendUser:', error);
        next(error);
    }
};

// ======================================================
// 🔄 ADMIN : Réactiver un utilisateur
// 🔧 Utilise la méthode activate() du modèle
// ======================================================
exports.activateUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

        await user.activate();

        const updated = await User.findById(req.params.id).select('-password');
        res.status(200).json({ status: 'success', message: '✅ Compte réactivé avec succès.', data: { user: updated } });
    } catch (error) {
        console.error('Erreur activateUser:', error);
        next(error);
    }
};

// ======================================================
// 🗑️ ADMIN : Supprimer un utilisateur
// 🔧 Supprime aussi la photo Cloudinary
// ======================================================
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

        await destroyFromCloudinary(user.photo);

        res.status(204).send();
    } catch (error) {
        console.error('Erreur deleteUser:', error);
        res.status(500).json({ status: 'error', message: "Erreur serveur lors de la suppression de l'utilisateur." });
    }
};