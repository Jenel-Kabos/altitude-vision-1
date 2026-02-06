/**
 * @fileoverview Routes API du tableau de bord Administrateur.
 * Toutes ces routes nécessitent une authentification et une autorisation
 * (rôle 'Admin' ou 'Collaborateur').
 */

const express = require('express');
const router = express.Router();

// =============================================================
// 📦 Import des contrôleurs et middlewares
// =============================================================
const adminController = require('../controllers/adminController');

// ✅ CORRECTION : Utilisation du contrôleur d'auth unifié
const authController = require('../controllers/authController');

// =============================================================
// 🛡️ ACCÈS RÉSERVÉ À L'ADMINISTRATEUR
// =============================================================
// Toutes les routes ci-dessous nécessitent d'être connecté
router.use(authController.protect);

// Seuls les Admins et Collaborateurs peuvent accéder
router.use(authController.restrictTo('Admin', 'Collaborateur'));


// =============================================================
// 📊 STATISTIQUES GLOBALES (Dashboard)
// =============================================================
router.get('/stats', adminController.getDashboardStats);
router.get('/activity', adminController.getActivityReport);


// =============================================================
// 🏠 GESTION DES PROPRIÉTÉS / PUBLICATIONS
// =============================================================

// 🔹 Obtenir uniquement les propriétés en attente
router.get('/properties/status/pending', adminController.getPendingProperties);

// 🔹 Obtenir toutes les propriétés
router.get('/properties', adminController.getAllProperties);

// 🔹 Validation ou rejet d'une propriété
router.patch('/properties/:id/approve', adminController.approveProperty);
router.patch('/properties/:id/reject', adminController.rejectProperty);

// 🔹 Suppression d'une propriété spécifique
router.delete('/properties/:id', adminController.deleteProperty);


// =============================================================
// 👤 GESTION DES UTILISATEURS / PROPRIÉTAIRES
// =============================================================

// 🚨 CRITIQUE : Cette route doit être AVANT '/owners/:id'
// Sinon "active-sessions" est pris pour un ID, ce qui plante le serveur.
router.get('/owners/active-sessions', adminController.getConnectedUsers);

// 🔹 Obtenir tous les utilisateurs
router.get('/owners', adminController.getAllUsers);

// 🔹 Actions spécifiques sur un utilisateur (Verify, Suspend, Ban...)
router.patch('/owners/:id/verify', adminController.verifyOwner);
router.patch('/owners/:id/suspend', adminController.suspendUser);
router.patch('/owners/:id/activate', adminController.activateUser);
router.patch('/owners/:id/ban', adminController.banUser);

// 🔹 Gestion individuelle (CRUD générique sur l'ID)
router.route('/owners/:id')
  .get(adminController.getUser)      // Voir les détails
  .patch(adminController.updateUser) // Modifier
  .delete(adminController.deleteUser); // Supprimer

// =============================================================
// 🚀 EXPORT DU ROUTEUR
// =============================================================
module.exports = router;