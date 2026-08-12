// --- server/routes/userRoutes.js ---
const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const { upload } = require('../config/cloudinary');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { requireTenantScope } = require('../middleware/tenantContext');

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
router.use(protect);

/* ===========================
   👤 UTILISATEUR CONNECTÉ
=========================== */
router.get('/me', userController.getMe, userController.getUser);
router.get('/me/contract-document', userController.downloadContractDocument);

// ✅ Mise à jour profil + photo (Cloudinary)
//    AccountPage envoie soit un FormData (avec "photo" ou "removePhoto")
//    soit un JSON classique — upload.single gère les deux cas
router.patch('/updateMe',         upload.single('photo'), authController.updateMe);

// ✅ Mise à jour mot de passe (pas de fichier → pas de multer)
router.patch('/updateMyPassword',                         authController.updateMyPassword);

// ✅ Compléter le profil après connexion Google
router.patch('/complete-profile',                         userController.completeProfile);

// ✅ Enregistrer le token Expo Push (appelé par le mobile au démarrage)
router.patch('/push-token',                               userController.savePushToken);

/* =======================================
   👑 ROUTES ADMIN UNIQUEMENT
======================================= */
router.use(restrictTo('Admin'));

router.get('/',        userController.getAllUsers);
router.get('/owners',  userController.getAllOwners);

// ✅ Création d'utilisateur par admin
router.post('/create-by-admin', userController.createByAdmin);

// ✅ Gestion admin + suspension / vérification KYC
router.patch('/:id/verify',             userController.verifyOwner);
router.patch('/:id/suspend',            userController.suspendUser);
router.patch('/:id/activate',           userController.activateUser);
router.patch('/:id/role',               userController.updateUserRole);
router.post( '/:id/renvoyer-contrat',   userController.renvoyerContrat);
router.get(  '/:id/contract-document',  requireTenantScope, userController.downloadContractDocument);

router
  .route('/:id')
  .get(userController.getUser)
  .put(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
