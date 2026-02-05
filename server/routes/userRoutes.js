// --- server/routes/userRoutes.js ---
const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

// ✅ MODIFICATION : On utilise Cloudinary pour les photos de profil (important pour Render)
const upload = require('../config/cloudinary'); 

const router = express.Router();

/* =======================================
   🔐 AUTHENTIFICATION PUBLIQUE
======================================= */
router.post('/signup', upload.single('photo'), authController.signup);
router.post('/login', authController.login);

// ✅ NOUVELLE ROUTE : Pour valider le lien reçu par email
router.get('/verify-email/:token', authController.verifyEmail);

/* =======================================
   🧭 ROUTES PROTÉGÉES (nécessite un token)
======================================= */
// Toutes les routes ci-dessous nécessitent d'être connecté
router.use(authController.protect);

/* ===========================
   👤 UTILISATEUR CONNECTÉ
=========================== */
router.get('/me', userController.getMe, userController.getUser);

// ✅ Mise à jour du profil (avec Cloudinary pour la photo)
// Note : J'utilise authController car c'est là que nous avons mis la fonction updateMe
router.patch('/updateMe', upload.single('photo'), authController.updateMe); 

// ✅ Mise à jour du mot de passe
router.patch('/updateMyPassword', authController.updateMyPassword);

/* =======================================
   👑 ROUTES ADMIN UNIQUEMENT
======================================= */
router.use(authController.restrictTo('Admin'));

// ✅ Récupérer tous les utilisateurs
router.get('/', userController.getAllUsers);

// ✅ Récupérer uniquement les propriétaires
router.get('/owners', userController.getAllOwners);

// ✅ Gestion d'un utilisateur spécifique
router
  .route('/:id')
  .get(userController.getUser)
  .put(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;