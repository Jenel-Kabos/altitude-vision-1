// --- server/controllers/userController.js ---
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

/* ======================================================
   🧭 UTILITAIRE : Récupère l’ID de l’utilisateur connecté
====================================================== */
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

/* ======================================================
   👑 ADMIN : Récupérer tous les utilisateurs
====================================================== */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: { users },
    });
  } catch (error) {
    console.error('Erreur getAllUsers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors de la récupération des utilisateurs.',
    });
  }
};

/* ======================================================
   👑 ADMIN : Récupérer tous les propriétaires
====================================================== */
exports.getAllOwners = async (req, res) => {
  try {
    const owners = await User.find({ role: 'Propriétaire' }).select('-password');
    res.status(200).json({
      status: 'success',
      results: owners.length,
      data: { owners },
    });
  } catch (error) {
    console.error('Erreur getAllOwners:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors de la récupération des propriétaires.',
    });
  }
};

/* ======================================================
   🔍 ADMIN : Récupérer un utilisateur par ID
====================================================== */
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'Aucun utilisateur trouvé avec cet ID.' });
    }
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) {
    console.error('Erreur getUser:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors de la récupération de l’utilisateur.',
    });
  }
};

/* ======================================================
   ✏️ USER : Mettre à jour son profil
====================================================== */
exports.updateMe = async (req, res) => {
  try {
    const allowedFields = ['name', 'email'];
    const updates = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) updates[key] = req.body[key];
    });

    if (req.file) {
      updates.photo = path.join('uploads/users', req.file.filename);
      const user = await User.findById(req.user.id);
      if (user?.photo) {
        const oldPhotoPath = path.join(process.cwd(), user.photo);
        if (fs.existsSync(oldPhotoPath)) fs.unlinkSync(oldPhotoPath);
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
      select: '-password',
    });

    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) {
    console.error('Erreur updateMe:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors de la mise à jour du profil.',
    });
  }
};

/* ======================================================
   🔐 USER : Mettre à jour son mot de passe
====================================================== */
exports.updateMyPassword = async (req, res) => {
  try {
    const { passwordCurrent, password, passwordConfirm } = req.body;

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

    const isCorrect = await user.correctPassword(passwordCurrent, user.password);
    if (!isCorrect) return res.status(401).json({ status: 'fail', message: 'Mot de passe actuel incorrect.' });

    user.password = password;
    user.passwordConfirm = passwordConfirm;
    await user.save();

    res.status(200).json({ status: 'success', data: { user: user.toObject({ getters: true, virtuals: true }) } });
  } catch (error) {
    console.error('Erreur updateMyPassword:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors de la mise à jour du mot de passe.',
    });
  }
};

/* ======================================================
   ✏️ ADMIN : Mettre à jour un utilisateur
====================================================== */
exports.updateUser = async (req, res) => {
  try {
    const allowedFields = ['name', 'email', 'role'];
    const updates = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) updates[key] = req.body[key];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
      select: '-password',
    });

    if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) {
    console.error('Erreur updateUser:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors de la mise à jour de l’utilisateur.',
    });
  }
};

// --- Fichier : server/controllers/userController.js ---

// (collez ce code à l'intérieur de votre fichier, avec les autres fonctions)

/* ======================================================
   ✅ ADMIN : Vérifier un propriétaire
====================================================== */
exports.verifyOwner = async (req, res, next) => {
  try {
    // Nous supposons que vous avez un champ 'isVerified' dans votre modèle User
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true, status: 'Actif' }, // Mettez à jour les champs pertinents
      { new: true, runValidators: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
    }

    res.status(200).json({
      status: 'success',
      message: '✅ Propriétaire vérifié avec succès.',
      data: { user },
    });
  } catch (error) {
    console.error('Erreur verifyOwner:', error);
    next(error); // Transmet l'erreur au gestionnaire global
  }
};

/* ======================================================
   ⚠️ ADMIN : Suspendre un utilisateur
====================================================== */
exports.suspendUser = async (req, res, next) => {
  try {
    // Nous supposons que vous avez un champ 'status' dans votre modèle User
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'Suspendu' }, // Mettez à jour le statut
      { new: true, runValidators: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
    }

    res.status(200).json({
      status: 'success',
      message: '⚠️ Compte suspendu avec succès.',
      data: { user },
    });
  } catch (error) {
    console.error('Erreur suspendUser:', error);
    next(error); // Transmet l'erreur au gestionnaire global
  }
};

/* ======================================================
   🔄 ADMIN : Réactiver un utilisateur
====================================================== */
exports.activateUser = async (req, res, next) => {
  try {
    // Nous supposons que vous avez un champ 'status' dans votre modèle User
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'Actif' }, // Mettez à jour le statut
      { new: true, runValidators: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
    }

    res.status(200).json({
      status: 'success',
      message: '✅ Compte réactivé avec succès.',
      data: { user },
    });
  } catch (error) {
    console.error('Erreur activateUser:', error);
    next(error); // Transmet l'erreur au gestionnaire global
  }
};

/* ======================================================
   🗑️ ADMIN : Supprimer un utilisateur
====================================================== */
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

    if (user.photo) {
      const photoPath = path.join(process.cwd(), user.photo);
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }

    res.status(204).json({ status: 'success', message: 'Utilisateur supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur deleteUser:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur lors de la suppression de l’utilisateur.',
    });
  }
};
