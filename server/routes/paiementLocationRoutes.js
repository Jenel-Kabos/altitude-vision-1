// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-B.2 —
// Canonical RENTAL payment routes (bounded context « location »).
//
// Chaîne d'autorité canonique tenant :
//   protect
//   → requireTenantScope
//   → requireTenantModule('location')
//   → requireTenantMembershipRole(...)
//   → markPaymentDomain('location')                (frontière commerciale)
//   → router.param('id', assertContratTenantAccessParam) — TENANT-CERT-2
//     réutilisé verbatim depuis paiementRoutes.js legacy
//   → assertRentalPaymentDomain (pour :id)         (frontière domaine)
//   → controller (partagé avec la surface legacy — jamais dupliqué)
//
// Contrats de séparation :
//  - Aucune modification de la logique financière (formules, receipt,
//    idempotence, CAS, ActionLog).
//  - Aucune surface hôtel/hébergement absorbée.
//  - Aucune surface vente absorbée (`Contrat.type='vente'` → 404 sur `:id`).
//  - Endpoints legacy `/api/paiements/*` conservés en compatibilité tant
//    que les consommateurs n'auront pas basculé.
//
// Matrice canonique businessRole (préservée depuis B.1) :
//  READ / STATS / RECEIPTS / NOTES / DUE DATE / COLLECTION
//   → Admin, Secretaire, Collaborateur
//  RECEIPT CANCELLATION / ELIGIBLE DELETE
//   → Admin
//  GestionnaireImmobilier n'a JAMAIS de droit paiement (matrice B.1
//  explicite).

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../controllers/authController');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantModule } = require('../middleware/tenantModuleGate');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
const { markPaymentDomain, assertRentalPaymentDomain } = require('../middleware/paymentDomain');
const { upload } = require('../config/cloudinary');
const ctrl = require('../controllers/paiementController');
const Paiement = require('../models/Paiement');
const { assertRentalResourceInTenant } = require('../services/platformTenant/rentalScopeService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const Contrat = require('../models/Contrat');
const { verifierPaiementsEnRetard } = require('../services/alerteService');
const { selectIndividualRoute, requireIndividualRentalScope } = require('../middleware/rentalScopeAccess');
const { assertIndividualRentalResourceAccess, individualRentalDomainIds } = require('../services/rentalIndividualResourceAccessService');

const router = express.Router();
const individualIdPath = '/:id([0-9a-fA-F]{24})';

const PAY_READ = ['Admin', 'Secretaire', 'Collaborateur'];
const PAY_MANAGE = ['Admin', 'Secretaire', 'Collaborateur'];
const PAY_CANCEL = ['Admin'];
const PAY_DELETE = ['Admin'];

const tenantAuthRead = [
  requireTenantScope,
  requireTenantModule('location'),
  requireTenantMembershipRole(...PAY_READ),
  markPaymentDomain('location'),
];
const tenantAuthManage = [
  requireTenantScope,
  requireTenantModule('location'),
  requireTenantMembershipRole(...PAY_MANAGE),
  markPaymentDomain('location'),
];
const tenantAuthCancel = [
  requireTenantScope,
  requireTenantModule('location'),
  requireTenantMembershipRole(...PAY_CANCEL),
  markPaymentDomain('location'),
];
const tenantAuthDelete = [
  requireTenantScope,
  requireTenantModule('location'),
  requireTenantMembershipRole(...PAY_DELETE),
  markPaymentDomain('location'),
];

router.use(auth.protect);

// TENANT-CERT-2 — même garde `router.param('id', …)` que paiementRoutes.js.
router.param('id', async (req, res, next, paiementId) => {
  try {
    if (!mongoose.isValidObjectId(paiementId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const paiement = await Paiement.findById(paiementId);
    if (!paiement) return res.status(404).json({ status: 'fail', message: 'Paiement introuvable.' });
    if (req.query?.scope === 'individual') {
      await assertIndividualRentalResourceAccess({ resourceType: 'Paiement', resource: paiement, userId: req.user._id || req.user.id });
      return next();
    }
    const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
    const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
    // C2.10A — Paiement → Contrat.bien → Property.tenant = tenant de la requête.
    await assertRentalResourceInTenant({ resourceType: 'Paiement', resource: paiement, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Paiement introuvable.' });
  }
});

const individualRead = [selectIndividualRoute, requireIndividualRentalScope, markPaymentDomain('location')];
const individualManage = [selectIndividualRoute, requireIndividualRentalScope, markPaymentDomain('location')];
router.get('/alertes', ...individualRead, ctrl.getAlertes);
router.get('/stats', ...individualRead, ctrl.getStats);
router.post('/encaisser-multiple', ...individualManage, upload.single('preuve'), ctrl.encaisserMultiple);
router.post('/calculer-penalites', ...individualManage, async (req, res) => {
  try {
    const { contractIds } = await individualRentalDomainIds(req.user._id || req.user.id);
    const result = await verifierPaiementsEnRetard({ contratIds: contractIds });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ status: (err.statusCode || 500) >= 500 ? 'error' : 'fail', message: err.message });
  }
});
router.get('/', ...individualRead, ctrl.getAll);
router.get(individualIdPath, ...individualRead, assertRentalPaymentDomain, ctrl.getOne);
router.get(`${individualIdPath}/proof`, ...individualRead, assertRentalPaymentDomain, ctrl.downloadProof);
router.put(individualIdPath, ...individualManage, assertRentalPaymentDomain, ctrl.update);
router.post(`${individualIdPath}/marquer-paye`, ...individualManage, assertRentalPaymentDomain, upload.single('preuve'), ctrl.marquerPaye);
router.get(`${individualIdPath}/receipts`, ...individualRead, assertRentalPaymentDomain, ctrl.listReceipts);
router.post(`${individualIdPath}/receipts/:receiptId/cancel`, ...individualManage, assertRentalPaymentDomain, ctrl.cancelReceipt);
router.delete(individualIdPath, ...individualManage, assertRentalPaymentDomain, ctrl.delete);

// ── Routes spécifiques avant `:id` ──────────────────────────────────────────
router.get('/alertes', ...tenantAuthRead, ctrl.getAlertes);
router.get('/stats', ...tenantAuthRead, ctrl.getStats);

// Encaissement multi-échéances — au même niveau que legacy `/encaisser-multiple`.
router.post('/encaisser-multiple', ...tenantAuthManage, upload.single('preuve'), ctrl.encaisserMultiple);

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-B.2 —
// exécution tenant-locale des pénalités : ne mute JAMAIS un paiement hors
// périmètre tenant/domaine, réutilise strictement les formules existantes.
router.post('/calculer-penalites', ...tenantAuthManage, async (req, res) => {
  try {
    // Résout la liste explicite des Contrat.location du tenant sélectionné
    // et la passe au service, jamais un scope global.
    const propertyMatchIds = await require('../models/Property').find({
      $or: [
        { tenant: req.platformTenant._id },
        { tenant: null, owner: { $in: req.tenantScopeUserIds || [] } },
      ],
    }).distinct('_id');
    const contratIds = propertyMatchIds.length
      ? await Contrat.find({ bien: { $in: propertyMatchIds }, type: 'location' }).distinct('_id')
      : [];
    const result = await verifierPaiementsEnRetard({ contratIds });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ status: (err.statusCode || 500) >= 500 ? 'error' : 'fail', message: err.message });
  }
});

// ── Liste racine (LOCATION uniquement) ──────────────────────────────────────
router.get('/', ...tenantAuthRead, ctrl.getAll);

// ── Routes `:id` (LOCATION uniquement, résolution domaine explicite) ────────
router.get('/:id', ...tenantAuthRead, assertRentalPaymentDomain, ctrl.getOne);
router.get('/:id/proof', ...tenantAuthRead, assertRentalPaymentDomain, ctrl.downloadProof);
router.put('/:id', ...tenantAuthManage, assertRentalPaymentDomain, ctrl.update);
router.post('/:id/marquer-paye', ...tenantAuthManage, assertRentalPaymentDomain, upload.single('preuve'), ctrl.marquerPaye);
router.get('/:id/receipts', ...tenantAuthRead, assertRentalPaymentDomain, ctrl.listReceipts);
router.post('/:id/receipts/:receiptId/cancel', ...tenantAuthCancel, assertRentalPaymentDomain, ctrl.cancelReceipt);
router.delete('/:id', ...tenantAuthDelete, assertRentalPaymentDomain, ctrl.delete);

module.exports = router;
