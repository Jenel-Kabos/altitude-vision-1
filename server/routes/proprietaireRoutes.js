const express    = require('express');
const mongoose   = require('mongoose');
const router     = express.Router();
const multer     = require('multer');
const auth       = require('../controllers/authController');
const ctrl       = require('../controllers/proprietaireController');
const { upload } = require('../config/cloudinary');
const { STAFF_IMMO } = require('../utils/roles');
const { requireTenantScope, requireTenantScopeForStaffOrPlatformOperator } = require('../middleware/tenantContext');
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

const protect    = [auth.protect, auth.restrictTo(...STAFF_IMMO)];
const readAll    = [auth.protect, auth.restrictTo(...STAFF_IMMO, 'Secretaire')];
const adminOnly  = [auth.protect, auth.restrictTo('Admin')];
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
router.get('/',       readAll,   requireTenantScopeForStaffOrPlatformOperator, ctrl.getAll);
router.get('/:id/identity-document', auth.protect, requireTenantScope, auth.restrictTo(...STAFF_IMMO, 'Secretaire'), ctrl.downloadIdentityDocument);
router.get('/:id',    readAll,   assertProprietaireInScope, ctrl.getOne);
router.post('/',      protect,   single, ctrl.create);
router.put('/:id',    protect,   assertProprietaireInScope, single, ctrl.update);
router.delete('/:id', protect,   assertProprietaireInScope, ctrl.delete);

// ── Gestion des biens ─────────────────────────────────────────
// PLATFORM-ADMIN-CERT-1 — même garde : muter les "biens" d'un Proprietaire
// d'un autre tenant était tout aussi accessible que le CRUD racine.
router.post(  '/:id/biens',                               protect, assertProprietaireInScope, multiPics, ctrl.addBien);
router.put(   '/:id/biens/:bienIndex',                    protect, assertProprietaireInScope, ctrl.updateBien);
router.delete('/:id/biens/:bienIndex',                    protect, assertProprietaireInScope, ctrl.deleteBien);
router.post(  '/:id/biens/:bienIndex/photos',             protect, assertProprietaireInScope, multiPics, ctrl.addBienPhotos);
router.delete('/:id/biens/:bienIndex/photos/:photoIndex', protect, assertProprietaireInScope, ctrl.deleteBienPhoto);

module.exports = router;
