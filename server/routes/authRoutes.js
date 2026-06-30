// server/routes/authRoutes.js
const express        = require('express');
const router         = express.Router();
const authController = require('../controllers/authController');
const { signupLimiter, resendVerificationLimiter, loginLimiter } = require('../middleware/rateLimiters');
const { protect } = require('../middleware/authMiddleware');

// ======================================================
// 🔓 ROUTES PUBLIQUES
// ======================================================

// Inscription & vérification email
router.post('/signup',               signupLimiter,             authController.signup);
router.get('/verify-email/:token',   authController.verifyEmail);
router.post('/resend-verification',  resendVerificationLimiter, authController.resendVerificationEmail);

// Connexion
router.post('/login',                loginLimiter, authController.login);

// Google OAuth
router.post('/google',               authController.googleAuth);
router.post('/google-token',         authController.googleGetToken);

// ✅ Mot de passe oublié → envoie l'email avec le lien
router.post('/forgot-password',      authController.forgotPassword);

// ✅ Réinitialisation avec le token reçu par email
router.patch('/reset-password/:token', authController.resetPassword);

// ======================================================
// 🔒 ROUTES PROTÉGÉES
// ======================================================
router.use(protect);

router.patch('/update-my-password',  authController.updateMyPassword);
router.patch('/update-me',           authController.updateMe);

module.exports = router;