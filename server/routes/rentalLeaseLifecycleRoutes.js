// GL-LIFE-1 — Routes du cycle de vie du bail. Même groupe de rôles que
// contratRoutes.js (STAFF_IMMO = Admin/GestionnaireImmobilier/Collaborateur)
// — la gestion du cycle de vie d'un bail est une extension de la gestion
// des contrats, jamais une nouvelle notion de permission.
// SECURITY-CLOSURE-P0-WAVE-1 (P0-D, finding RA-05) — ce routeur opère sur le
// même modèle `Contrat` que contratRoutes.js (chaque handler du contrôleur
// résout `req.params.id` comme un ObjectId de Contrat), mais n'avait jamais
// reçu le `router.param('id', …)` tenant (TENANT-CERT-2) qui protège déjà
// les routes `:id` de contratRoutes.js/paiementRoutes.js. Réutilisation
// verbatim du même garde canonique — aucune nouvelle politique inventée. Le
// garde lui-même vit dans le contrôleur (`ctrl.assertContratTenantAccessParam`)
// plutôt que d'importer `models/Contrat` directement ici, pour ne pas créer
// un nouvel edge route→model (catégorie de dette suivie par
// architecture:check, ARCH-LAYER-003) — cette route déclarait 0 edge de ce
// type avant ce hotfix, contrairement à contratRoutes.js/paiementRoutes.js
// déjà présents dans la baseline.
const express = require('express');
const auth = require('../controllers/authController');
const { STAFF_IMMO } = require('../utils/roles');
const ctrl = require('../controllers/rentalLeaseLifecycleController');

const router = express.Router();
const protect = [auth.protect, auth.restrictTo(...STAFF_IMMO)];

// SECURITY-CLOSURE-P0-WAVE-1 — `router.param('id', …)` s'exécute avant le
// tableau de middlewares propre à chaque route (donc avant `auth.protect`
// listé ci-dessus) : `router.use(auth.protect)` est donc nécessaire pour que
// `req.user` soit déjà défini au moment du contrôle tenant, exactement comme
// dans contratRoutes.js/paiementRoutes.js.
router.use(auth.protect);

router.param('id', ctrl.assertContratTenantAccessParam);

router.get('/dashboard', protect, ctrl.dashboard);
router.get('/:id/available-transitions', protect, ctrl.availableTransitions);
router.post('/:id/transition', protect, ctrl.transition);
router.post('/:id/renew/preview', protect, ctrl.previewRenew);
router.post('/:id/renew', protect, ctrl.renew);
router.post('/:id/avenants', protect, ctrl.addAvenant);
router.post('/:id/caution/encaisser', protect, ctrl.encaisserCaution);
router.post('/:id/caution/bloquer', protect, ctrl.bloquerCaution);
router.post('/:id/caution/retenue', protect, ctrl.appliquerRetenueCaution);
router.post('/:id/caution/restituer', protect, ctrl.restituerCaution);

module.exports = router;
