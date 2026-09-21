const express    = require('express');
const mongoose   = require('mongoose');
const router     = express.Router();
const multer     = require('multer');
const auth       = require('../controllers/authController');
const ctrl       = require('../controllers/proprietaireController');
const { upload } = require('../config/cloudinary');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantModule } = require('../middleware/tenantModuleGate');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
// PLATFORM-ADMIN-CERT-1 — vulnérabilité V2 corrigée, même patron que
// locataireRoutes.js (voir son commentaire pour le détail complet).
const Proprietaire = require('../models/Proprietaire');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');

router.use(auth.protect);

// PLATFORM-ADMIN-CERT-1 — middleware EXPLICITE, jamais `router.param`, qui
// s'exécuterait avant le contrôle de rôle propre à chaque route (voir le
// commentaire détaillé dans locataireRoutes.js — même piège d'ordonnancement
// Express évité ici de la même façon).
async function assertProprietaireInScope(req, res, next) {
  try {
    const proprietaireId = req.params.id;
    if (!mongoose.isValidObjectId(proprietaireId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const proprietaire = await Proprietaire.findById(proprietaireId);
    if (!proprietaire) return res.status(404).json({ status: 'fail', message: 'Propriétaire introuvable.' });
    const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
    const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
    await assertResourceTenantOrUnattributed({ resourceType: 'Proprietaire', resource: proprietaire, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Propriétaire introuvable.' });
  }
}

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-D — Autorité tenant canonique :
//   protect (au niveau routeur, déjà appliqué)
//   → requireTenantScope
//   → requireTenantModule('location')
//   → requireTenantMembershipRole(...)
//   → assertProprietaireInScope (cross-tenant per-`:id`)
//
// Ce routeur ne comporte pas de branche self/ownership : un Proprietaire
// gère son propre profil via `/api/users/me` (et ses ressources via les
// endpoints `/owner/*` du rental-management, Lot C). Toutes les routes ici
// sont donc TENANT-scopées — une agence gère des mandants dans son
// portefeuille. `restrictTo(...STAFF_IMMO, 'Secretaire')` et
// `restrictTo(...STAFF_IMMO)` — qui lisaient `User.role` global comme
// autorité tenant — sont retirés au profit de `requireTenantMembershipRole`.
const GL_READ = ['Admin', 'GestionnaireImmobilier', 'Collaborateur', 'Secretaire'];
const GL_MANAGE = ['Admin', 'GestionnaireImmobilier'];

const tenantAuthBase = [
  requireTenantScope,
  requireTenantModule('location'),
];
const tenantRead = [...tenantAuthBase, requireTenantMembershipRole(...GL_READ)];
const tenantManage = [...tenantAuthBase, requireTenantMembershipRole(...GL_MANAGE)];

const multiPics  = upload.array('photos', 20);

// Multer dédié pièce d'identité : 5 MB, PDF + images uniquement
const PIECE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const single = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    PIECE_MIMES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Format non supporté. Utilisez PDF, JPEG ou PNG'), false);
  },
}).single('pieceIdentite');

// ── CRUD Proprietaire ─────────────────────────────────────────
// SECURITY-CLOSURE-P1-WAVE-1 (P1-J, finding RA-15) — `GET /` n'appliquait
// aucune frontière tenant, contrairement aux routes `:id` de ce fichier.
router.get('/',                       ...tenantRead, ctrl.getAll);
router.get('/:id/identity-document',  ...tenantRead, ctrl.downloadIdentityDocument);
router.get('/:id',                    ...tenantRead, assertProprietaireInScope, ctrl.getOne);
router.post('/',                      ...tenantManage, single, ctrl.create);
router.put('/:id',                    ...tenantManage, assertProprietaireInScope, single, ctrl.update);
router.delete('/:id',                 ...tenantManage, assertProprietaireInScope, ctrl.delete);

// ── Gestion des biens ─────────────────────────────────────────
// PLATFORM-ADMIN-CERT-1 — même garde : muter les "biens" d'un Proprietaire
// d'un autre tenant était tout aussi accessible que le CRUD racine.
router.post(  '/:id/biens',                               ...tenantManage, assertProprietaireInScope, multiPics, ctrl.addBien);
router.put(   '/:id/biens/:bienIndex',                    ...tenantManage, assertProprietaireInScope, ctrl.updateBien);
router.delete('/:id/biens/:bienIndex',                    ...tenantManage, assertProprietaireInScope, ctrl.deleteBien);
router.post(  '/:id/biens/:bienIndex/photos',             ...tenantManage, assertProprietaireInScope, multiPics, ctrl.addBienPhotos);
router.delete('/:id/biens/:bienIndex/photos/:photoIndex', ...tenantManage, assertProprietaireInScope, ctrl.deleteBienPhoto);

module.exports = router;
