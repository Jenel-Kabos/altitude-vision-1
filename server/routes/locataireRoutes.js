const express    = require('express');
const mongoose   = require('mongoose');
const router     = express.Router();
const auth       = require('../controllers/authController');
const ctrl       = require('../controllers/locataireController');
const { upload } = require('../config/cloudinary');
const { requireTenantScope, requireTenantScopeForStaffOrPlatformOperator } = require('../middleware/tenantContext');
// PLATFORM-ADMIN-CERT-1 — vulnérabilité V2 corrigée : seule la route
// `identity-document` vérifiait le tenant. `GET /`, `GET/PUT/DELETE /:id`
// n'avaient AUCUNE frontière — un Admin/staff d'un tenant pouvait consulter/
// modifier/supprimer le Locataire d'un autre tenant en devinant un ObjectId
// (démontré par test adversarial). Même patron que paiementRoutes.js/
// contratRoutes.js : `router.param('id', …)` + `assertResourceTenantOrUnattributed`,
// qui supporte déjà nativement `resourceType: 'Locataire'`.
const Locataire = require('../models/Locataire');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const { requireCapability } = require('../middleware/capabilityMiddleware');

const manageTenants = [auth.protect, requireCapability('tenants.manage')];
const readTenants = [auth.protect, requireCapability('tenants.read')];
const fileField  = upload.single('pieceIdentite');

router.use(auth.protect);

// PLATFORM-ADMIN-CERT-1 — appliqué comme middleware EXPLICITE sur les seules
// routes GET/PUT/DELETE `/:id` (le périmètre réellement démontré vulnérable,
// voir V2 dans PLATFORM_ADMIN_CERT_1_AUDIT.md), jamais via `router.param`.
// `router.param('id', …)` s'exécute AVANT tout middleware propre à la route
// (y compris `readAll`/`protect` ci-dessus) pour CHAQUE route portant `:id`
// — ce qui aurait fait courir cette vérification tenant avant même le
// contrôle de rôle sur `/:id/invite`, `/:id/dossier`, etc., cassant leurs
// codes d'erreur attendus (403 rôle → 404 ressource) sans jamais avoir été
// le périmètre de la vulnérabilité. Une fonction dédiée, positionnée APRÈS
// le contrôle de rôle dans le tableau de middlewares de chaque route
// concernée, évite complètement ce piège d'ordonnancement Express.
async function assertLocataireInScope(req, res, next) {
  try {
    const locataireId = req.params.id;
    if (!mongoose.isValidObjectId(locataireId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const locataire = await Locataire.findById(locataireId);
    if (!locataire) return res.status(404).json({ status: 'fail', message: 'Locataire introuvable.' });
    const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
    const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
    await assertResourceTenantOrUnattributed({ resourceType: 'Locataire', resource: locataire, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Locataire introuvable.' });
  }
}

// SECURITY-CLOSURE-P1-WAVE-1 (P1-J, finding RA-15) — `GET /` et
// `GET /dossiers` n'appliquaient aucune frontière tenant, contrairement aux
// routes `:id` protégées par `assertLocataireInScope`.
router.get('/', readTenants, requireTenantScopeForStaffOrPlatformOperator, ctrl.getAll);
// Sprint GL-B2 — littéraux/2-segments AVANT le fallback générique /:id
// (convention de routage déjà établie dans ce projet, voir hotelRoutes.js).
router.get('/dossiers', readTenants, requireTenantScopeForStaffOrPlatformOperator, ctrl.listDossiers);
// Dette technique GL-B2 — liaison User ↔ Locataire (Missions 1 & 3),
// littéraux avant /:id également.
router.get('/link-requests', readTenants, ctrl.listLinkRequests);
router.patch('/link-requests/:requestId/review', manageTenants, ctrl.reviewLinkRequest);
router.patch('/invitations/:requestId/cancel', manageTenants, ctrl.cancelInvitation);
router.post('/invitations/:requestId/resend', manageTenants, ctrl.resendInvitation);
// SECURITY-CLOSURE-P1-WAVE-1 (P1-J, finding RA-15) — cette route n'était pas
// enveloppée par `assertLocataireInScope`, contrairement à ses routes
// sœurs `:id` (GET/PUT/DELETE) ci-dessous.
router.get('/:id/dossier', readTenants, assertLocataireInScope, ctrl.getDossier);
router.get('/:id/identity-document', requireTenantScope, requireCapability('tenants.read'), ctrl.downloadIdentityDocument);
router.post('/:id/invite', manageTenants, ctrl.invite);
router.get('/:id', readTenants, assertLocataireInScope, ctrl.getOne);
router.post('/', manageTenants, fileField, ctrl.create);
router.put('/:id', manageTenants, assertLocataireInScope, fileField, ctrl.update);
router.delete('/:id', manageTenants, assertLocataireInScope, ctrl.delete);

module.exports = router;
