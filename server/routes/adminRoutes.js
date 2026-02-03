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
const authMiddleware = require('../middleware/authMiddleware');

// =============================================================
// 🛡️ ACCÈS RÉSERVÉ À L'ADMINISTRATEUR
// =============================================================
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('Admin', 'Collaborateur')); // Ajout de 'Collaborateur' comme prévu dans ta doc

// =============================================================
// 🏠 GESTION DES PROPRIÉTÉS / PUBLICATIONS
// =============================================================

// 🔹 Obtenir toutes les propriétés (avec filtrage facultatif)
router.route('/properties')
  .get(adminController.getAllProperties);

// 🔹 Obtenir uniquement les propriétés en attente
router.route('/properties/status/pending')
  .get(adminController.getPendingProperties);

// 🔹 Actions sur une propriété spécifique
router.route('/properties/:id')
  // .get(adminController.getProperty) // Optionnel : à implémenter si besoin
  .delete(adminController.deleteProperty);

// 🔹 Validation ou rejet d'une propriété
router.patch('/properties/:id/approve', adminController.approveProperty);
router.patch('/properties/:id/reject', adminController.rejectProperty);

// =============================================================
// 👤 GESTION DES UTILISATEURS / PROPRIÉTAIRES
// =============================================================

// 🔹 Obtenir les sessions actives (utilisateurs connectés)
router.route('/owners/active-sessions')
  .get(adminController.getConnectedUsers);

// 🔹 Obtenir tous les propriétaires
router.route('/owners')
  .get(adminController.getAllOwners);

// 🔹 Gestion individuelle d’un propriétaire
router.route('/owners/:id')
  .get(adminController.getUser)          // Récupération des infos d’un propriétaire
  .patch(adminController.updateUser)     // Mise à jour des infos générales
  .delete(adminController.deleteUser);   // Suppression d’un utilisateur

// 🔹 Actions spécifiques sur un propriétaire
router.patch('/owners/:id/verify', adminController.verifyOwner);   // ✅ Fonction désormais existante
router.patch('/owners/:id/suspend', adminController.suspendUser);
router.patch('/owners/:id/activate', adminController.activateUser);
router.patch('/owners/:id/ban', adminController.banUser);

// =============================================================
// 🚀 EXPORT DU ROUTEUR
// =============================================================
module.exports = router;
