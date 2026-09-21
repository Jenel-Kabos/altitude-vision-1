// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV — CONTRAT-DOMAIN-SPLIT.
//
// Surface HTTP typée LOCATION du domaine Contrat.
//
// Chaîne d'autorité canonique :
//   protect
//   → requireTenantScope
//   → requireTenantModule('location')
//   → requireTenantMembershipRole(...)
//   → router.param('id', assertResourceTenantOrUnattributed) — TENANT-CERT-2
//   → requireContratType('location')                          — type guard
//   → controller
//
// Contrats de séparation :
//   - Modèle Mongo Contrat inchangé (CONTRAT_STORAGE_SPLIT_REQUIRED=NO).
//   - Utilise le contrôleur canonique existant `contratController` (allow-
//     list, lifecycle location, side effects DELETE). Aucune duplication
//     de logique métier.
//   - Un contrat type='vente' présenté ici → 404 fail-closed (jamais un
//     403 qui trahirait l'existence de la ressource).
//   - Aucune écriture Paiement : POST /:id/paiements reste 410 (B3).

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../controllers/authController');
const ctrl = require('../controllers/contratController');
const Contrat = require('../models/Contrat');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantModule } = require('../middleware/tenantModuleGate');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
const { requireContratType } = require('../middleware/contratTypeGuard');

const READ_ROLES = ['Admin', 'GestionnaireImmobilier', 'Collaborateur', 'Secretaire'];
const MUTATE_ROLES = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];
const DELETE_ROLES = ['Admin'];
const PAYMENT_READ_ROLES = ['Admin', 'Secretaire', 'Collaborateur'];

const tenantRead = [requireTenantScope, requireTenantModule('location'), requireTenantMembershipRole(...READ_ROLES)];
const tenantMutate = [requireTenantScope, requireTenantModule('location'), requireTenantMembershipRole(...MUTATE_ROLES)];
const tenantDelete = [requireTenantScope, requireTenantModule('location'), requireTenantMembershipRole(...DELETE_ROLES)];
const tenantPaymentRead = [requireTenantScope, requireTenantModule('location'), requireTenantMembershipRole(...PAYMENT_READ_ROLES)];

router.use(auth.protect);

router.param('id', async (req, res, next, contratId) => {
  try {
    if (!mongoose.isValidObjectId(contratId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const contrat = await Contrat.findById(contratId);
    if (!contrat) return res.status(404).json({ status: 'fail', message: 'Contrat introuvable.' });
    const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
    const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
    await assertResourceTenantOrUnattributed({ resourceType: 'Contrat', resource: contrat, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Contrat introuvable.' });
  }
});

router.get('/', ...tenantRead, (req, res, next) => { req.query.type = 'location'; return ctrl.getAll(req, res, next); });
router.get('/:id', ...tenantRead, requireContratType('location'), ctrl.getOne);
router.put('/:id', ...tenantMutate, requireContratType('location'), ctrl.update);
router.delete('/:id', ...tenantDelete, requireContratType('location'), ctrl.delete);
router.get('/:id/paiements', ...tenantPaymentRead, requireContratType('location'), ctrl.getPaiements);
router.post('/:id/paiements', ...tenantPaymentRead, requireContratType('location'), ctrl.createPaiement); // 410 (B3)

module.exports = router;
