// --- server/routes/userRoutes.js ---
const express = require('express');
const mongoose = require('mongoose');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const { upload } = require('../config/cloudinary');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { requireTenantScope } = require('../middleware/tenantContext');
const { attachTenantContext } = require('../middleware/tenantContext');
const { resolveActiveOperator, hasCapability } = require('../services/platformOperator/platformOperatorService');
const { requirePlatformOperatorCapability } = require('../middleware/platformAuthority');
const { expandScopeWithUnaffiliatedUsersIfSoleTenant } = require('../services/unaffiliatedUserScopeService');

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
router.use(restrictTo('Admin'), attachTenantContext);

// Tenant Admin legacy remains tenant-scoped. A PlatformOperator with the
// explicit users.read capability may use the same resource in platform mode.
const requireUsersReadScope = async (req, res, next) => {
  if (req.isPlatformOperatorContext) {
    req.platformOperator = req.platformOperator || await resolveActiveOperator(req.user?._id || req.user?.id).catch(() => null);
    if (!hasCapability(req.platformOperator, 'platform.users.read')) {
      return res.status(403).json({ status: 'fail', message: 'Capacité platform.users.read requise.' });
    }
    // A selected operator tenant still needs the canonical tenant-scope
    // resolver so list/detail operations receive tenantScopeUserIds.
    if (req.platformTenant) return requireTenantScope(req, res, next);
    return next();
  }
  return requireTenantScope(req, res, next);
};

const requireUsersManageForPlatformOperator = (req, res, next) => {
  if (req.isPlatformOperatorContext && !hasCapability(req.platformOperator, 'platform.users.manage')) {
    return res.status(403).json({ status: 'fail', message: 'Capacité platform.users.manage requise.' });
  }
  return next();
};

router.use(requireUsersReadScope);

// `router.param('id', …)` s'exécute AVANT chaque route `:id` ci-dessous —
// même patron que paiementRoutes.js/contratRoutes.js/platformTenantRoutes.js.
// HOTFIX-OWNER-CONTRACT-RESEND-1 — utilisait `req.tenantScopeUserIds` brut
// (scope `OrgMembership` strict, posé par `requireTenantScope`), alors que
// `getAllUsers`/`getAllOwners` (HOTFIX-USERS-COUNT-1) l'étendent localement
// aux comptes non affiliés sur tenant unique : un compte visible dans la
// liste restait donc 404 sur CHAQUE action individuelle (renvoyer-contrat,
// contract-document, verify, suspend, activate, role, GET/PUT/DELETE) —
// deux chemins résolvant une identité différente pour la même ressource.
// Réutilise la même fonction canonique (jamais réimplémentée).
router.param('id', async (req, res, next, userId) => {
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
  const scopeUserIds = await expandScopeWithUnaffiliatedUsersIfSoleTenant(req.tenantScopeUserIds || [])
    .catch(() => req.tenantScopeUserIds || []);
  const globalPlatformRead = req.isPlatformOperatorContext && !req.platformTenant
    && hasCapability(req.platformOperator, 'platform.users.read');
  const inScope = globalPlatformRead || scopeUserIds.some((id) => String(id) === String(userId));
  if (!inScope) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
  next();
});

router.get('/',        userController.getAllUsers);
router.get('/owners',  userController.getAllOwners);

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1F — les mutations qui touchent
// l'identité GLOBALE d'un User (création, changement de rôle global, gel
// d'accès global, suppression) doivent désormais exiger une autorité
// plateforme explicite : PlatformOperator ACTIF + capability
// `platform.users.manage`. Ni `User.role === 'Admin'` ni
// `OrgMembership.businessRole === 'Admin'` ne suffisent. Le workflow tenant
// canonique passe par /api/members (Phase 1D). Le routage tenant scope
// (`requireTenantScope`, `router.param('id')`) reste actif comme deuxième
// filet — sur un contexte plateforme sélectionné, la resolveActiveOperator
// donne l'accès. Sur un contexte tenant, le second gate ferme sur les tests
// LEGACY-01..LEGACY-12 ci-dessous.
const requireGlobalUsersManage = requirePlatformOperatorCapability('platform.users.manage');

// ✅ Création d'utilisateur par admin — ne cible aucune ressource existante
//    d'un autre tenant, donc hors périmètre de la garde `:id` ci-dessus.
router.post('/create-by-admin', requireGlobalUsersManage, userController.createByAdmin);

// ✅ Gestion admin + suspension / vérification KYC. verifyOwner /
// renvoyerContrat restent sous le garde legacy (utilisateurs propriétaires
// vérifiés dans leur tenant — hors périmètre 1F ; on ne les rouvre pas ici).
router.patch('/:id/verify',             requireUsersManageForPlatformOperator, userController.verifyOwner);
router.patch('/:id/suspend',            requireGlobalUsersManage, userController.suspendUser);
router.patch('/:id/activate',           requireGlobalUsersManage, userController.activateUser);
router.patch('/:id/role',               requireGlobalUsersManage, userController.updateUserRole);
router.post( '/:id/renvoyer-contrat',   requireUsersManageForPlatformOperator, userController.renvoyerContrat);
router.get(  '/:id/contract-document',  userController.downloadContractDocument);

router
  .route('/:id')
  .get(userController.getUser)
  .put(requireGlobalUsersManage, userController.updateUser)
  .delete(requireGlobalUsersManage, userController.deleteUser);

module.exports = router;
