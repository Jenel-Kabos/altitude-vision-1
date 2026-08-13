// --- server/routes/userRoutes.js ---
const express = require('express');
const mongoose = require('mongoose');
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
// PLATFORM-ADMIN-CERT-1 — vulnérabilité V1 corrigée : ce routeur n'imposait
// AUCUNE frontière tenant au-delà du rôle seul. Un Admin du Tenant A pouvait
// lister/consulter/modifier/suspendre/activer/changer le rôle de/supprimer
// N'IMPORTE QUEL utilisateur de N'IMPORTE QUEL tenant en devinant un ObjectId
// (démontré par test adversarial, voir __tests__/platformAdminCert1.*).
// `requireTenantScope` — même couche centrale que partout ailleurs dans le
// dépôt — attache `req.tenantScopeUserIds` : l'ensemble des utilisateurs
// réellement membres du tenant actif (ou du tenant explicitement sélectionné
// par un PlatformOperator). Jamais un correctif isolé par contrôleur.
router.use(restrictTo('Admin'), requireTenantScope);

// `router.param('id', …)` s'exécute AVANT chaque route `:id` ci-dessous —
// même patron que paiementRoutes.js/contratRoutes.js/platformTenantRoutes.js.
router.param('id', (req, res, next, userId) => {
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
  const inScope = (req.tenantScopeUserIds || []).some((id) => String(id) === String(userId));
  if (!inScope) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
  next();
});

router.get('/',        userController.getAllUsers);
router.get('/owners',  userController.getAllOwners);

// ✅ Création d'utilisateur par admin — ne cible aucune ressource existante
//    d'un autre tenant, donc hors périmètre de la garde `:id` ci-dessus.
router.post('/create-by-admin', userController.createByAdmin);

// ✅ Gestion admin + suspension / vérification KYC
router.patch('/:id/verify',             userController.verifyOwner);
router.patch('/:id/suspend',            userController.suspendUser);
router.patch('/:id/activate',           userController.activateUser);
router.patch('/:id/role',               userController.updateUserRole);
router.post( '/:id/renvoyer-contrat',   userController.renvoyerContrat);
router.get(  '/:id/contract-document',  userController.downloadContractDocument);

router
  .route('/:id')
  .get(userController.getUser)
  .put(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
