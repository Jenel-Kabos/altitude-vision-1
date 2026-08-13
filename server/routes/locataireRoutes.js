const express    = require('express');
const mongoose   = require('mongoose');
const { STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM } = require('../utils/roles');
const router     = express.Router();
const auth       = require('../controllers/authController');
const ctrl       = require('../controllers/locataireController');
const { upload } = require('../config/cloudinary');
const { requireTenantScope } = require('../middleware/tenantContext');
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

const protect    = [auth.protect, auth.restrictTo(...STAFF_IMMO)];
const readAll    = [auth.protect, auth.restrictTo(...STAFF_IMMO, 'Secretaire')];
const adminOnly  = [auth.protect, auth.restrictTo('Admin')];
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

router.get('/',       readAll,   ctrl.getAll);
// Sprint GL-B2 — littéraux/2-segments AVANT le fallback générique /:id
// (convention de routage déjà établie dans ce projet, voir hotelRoutes.js).
router.get('/dossiers', readAll, ctrl.listDossiers);
// Dette technique GL-B2 — liaison User ↔ Locataire (Missions 1 & 3),
// littéraux avant /:id également.
router.get('/link-requests', protect, ctrl.listLinkRequests);
router.patch('/link-requests/:requestId/review', protect, ctrl.reviewLinkRequest);
router.patch('/invitations/:requestId/cancel', protect, ctrl.cancelInvitation);
router.post('/invitations/:requestId/resend', protect, ctrl.resendInvitation);
router.get('/:id/dossier', readAll, ctrl.getDossier);
router.get('/:id/identity-document', requireTenantScope, auth.restrictTo(...STAFF_IMMO, 'Secretaire'), ctrl.downloadIdentityDocument);
router.post('/:id/invite', protect, ctrl.invite);
router.get('/:id',    readAll,   assertLocataireInScope, ctrl.getOne);
router.post('/',      protect,   fileField, ctrl.create);
router.put('/:id',    protect,   assertLocataireInScope, fileField, ctrl.update);
router.delete('/:id', protect,   assertLocataireInScope, ctrl.delete);

module.exports = router;
