// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ======================================================
// 🔓 ROUTES PUBLIQUES (sans authentification)
// ======================================================

// Inscription
router.post('/signup', authController.signup);

// Connexion
router.post('/login', authController.login);

// ✅ Vérification email via le lien reçu (token dans l'URL)
router.get('/verify-email/:token', authController.verifyEmail);

// ✅ Renvoyer l'email de vérification si lien expiré
router.post('/resend-verification', authController.resendVerificationEmail);

// ======================================================
// 🔒 ROUTES PROTÉGÉES (authentification requise)
// ======================================================
router.use(authController.protect);

// Mise à jour du mot de passe
router.patch('/update-my-password', authController.updateMyPassword);

// Mise à jour du profil
router.patch('/update-me', authController.updateMe);

module.exports = router;