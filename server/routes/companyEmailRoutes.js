// server/routes/companyEmailRoutes.js
const express = require('express');
const router = express.Router();

// ✅ IMPORT 1 : Le contrôleur logique
const companyEmailController = require('../controllers/companyEmailController');

// ✅ IMPORT 2 : La sécurité unifiée (et pas l'ancien middleware)
const authController = require('../controllers/authController');
const { STAFF_ALL } = require('../utils/roles');

// ======================================================
// 🔒 PROTECTION GLOBALE
// ======================================================
// Toutes les routes nécessitent d'être connecté
router.use(authController.protect);

// Par défaut, accès Admin et Collaborateur (pour voir), 
// mais on restreindra la suppression/création plus bas si nécessaire.
router.use(authController.restrictTo(...STAFF_ALL));


// ======================================================
// 1️⃣ ROUTES SPÉCIFIQUES (DOIVENT ÊTRE EN PREMIER !)
// ======================================================

// 📊 Statistiques (Si placé après /:id, "stats" serait pris pour un ID -> Erreur 500)
router.get('/stats', companyEmailController.getGlobalStats);

// 📋 Listes filtrées
router.get('/active', companyEmailController.getActiveEmails);
router.get('/notifications/quotes', companyEmailController.getQuoteNotificationEmails);
router.get('/notifications/contact', companyEmailController.getContactNotificationEmails);

// 👤 Par utilisateur
router.get('/user/:userId', companyEmailController.getEmailsByUser);


// ======================================================
// 2️⃣ ROUTE RACINE (LISTE & CRÉATION)
// ======================================================
router.get('/', companyEmailController.getAllEmails);

// Création : Réservé aux Admins (Sécurité supplémentaire)
router.post('/', authController.restrictTo('Admin'), companyEmailController.createEmail);


// ======================================================
// 3️⃣ ROUTES DYNAMIQUES (AVEC :id - À LA FIN)
// ======================================================

// Actions spécifiques (Patch)
router.patch('/:id/toggle-status', companyEmailController.toggleEmailStatus);
router.patch('/:id/notifications', companyEmailController.updateNotifications);
router.patch('/:id/increment-sent', companyEmailController.incrementSent);
router.patch('/:id/increment-received', companyEmailController.incrementReceived);

// Opérations CRUD sur un ID
router.route('/:id')
    .get(companyEmailController.getEmailById)
    .put(authController.restrictTo('Admin'), companyEmailController.updateEmail) // Admin modifie
    .delete(authController.restrictTo('Admin'), companyEmailController.deleteEmail); // Admin supprime

module.exports = router;