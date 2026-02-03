// --- server/routes/userRoutes.js ---
const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const upload = require('../middleware/uploadMiddleware'); // ✅ Import correct

const router = express.Router();

/* =======================================
   🔐 AUTHENTIFICATION PUBLIQUE
======================================= */
router.post('/signup', upload.single('photo'), authController.signup);
router.post('/login', authController.login);

/* =======================================
   🧭 ROUTES PROTÉGÉES (nécessite un token)
======================================= */
router.use(authController.protect);

/* ===========================
   👤 UTILISATEUR CONNECTÉ
=========================== */
router.get('/me', userController.getMe, userController.getUser);
router.patch('/updateMe', upload.single('photo'), userController.updateMe); // ✅ Correction ici
router.patch('/updateMyPassword', userController.updateMyPassword);

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