// --- server/routes/userRoutes.js ---
const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const { upload } = require('../config/cloudinary');

const router = express.Router();

/* =======================================
   🔐 AUTHENTIFICATION PUBLIQUE
======================================= */
router.post('/signup',              upload.single('photo'), authController.signup);
router.post('/login',                                       authController.login);
router.get( '/verify-email/:token',                         authController.verifyEmail);

/* =======================================
   🧭 ROUTES PROTÉGÉES (token requis)
======================================= */
router.use(authController.protect);

/* ===========================
   👤 UTILISATEUR CONNECTÉ
=========================== */
router.get('/me', userController.getMe, userController.getUser);

// ✅ Mise à jour profil + photo (Cloudinary)
//    AccountPage envoie soit un FormData (avec "photo" ou "removePhoto")
//    soit un JSON classique — upload.single gère les deux cas
router.patch('/updateMe',         upload.single('photo'), authController.updateMe);

// ✅ Mise à jour mot de passe (pas de fichier → pas de multer)
router.patch('/updateMyPassword',                         authController.updateMyPassword);

/* =======================================
   👑 ROUTES ADMIN UNIQUEMENT
======================================= */
router.use(authController.restrictTo('Admin'));

router.get('/',        userController.getAllUsers);
router.get('/owners',  userController.getAllOwners);

// ✅ Gestion admin + suspension / vérification KYC
router.patch('/:id/verify',   userController.verifyOwner);
router.patch('/:id/suspend',  userController.suspendUser);
router.patch('/:id/activate', userController.activateUser);

router
  .route('/:id')
  .get(userController.getUser)
  .put(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;