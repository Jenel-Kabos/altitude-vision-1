// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV — CONTRAT-DOMAIN-SPLIT.
//
// Surface HTTP typée VENTE du domaine Contrat.
//
// Chaîne d'autorité canonique :
//   protect
//   → requireTenantScope
//   → requireTenantMembershipRole(...)
//   → router.param('id', assertResourceTenantOrUnattributed) — TENANT-CERT-2
//   → requireContratType('vente')                             — type guard
//   → controller
//
// PAS de `requireTenantModule('location')` — c'est le cœur de B1 : un
// tenant sans module location conserve l'accès à ses contrats de vente
// si son autorité métier tenant le permet. Aucune machine d'état vente
// n'est implémentée ici (voir suivi SALE_CONTRACT_LIFECYCLE).
//
// POST /:id/paiements N'EXISTE PAS sur cette surface : la vente ne
// s'écoule PAS par la surface paiement location (B.2) ni par l'ancien
// bare `Paiement.create` (B3 retiré).

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../controllers/authController');
const ctrl = require('../controllers/contratController');
const Contrat = require('../models/Contrat');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
const { requireContratType } = require('../middleware/contratTypeGuard');

const READ_ROLES = ['Admin', 'GestionnaireImmobilier', 'Collaborateur', 'Secretaire'];
const MUTATE_ROLES = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];
const DELETE_ROLES = ['Admin'];

const tenantRead = [requireTenantScope, requireTenantMembershipRole(...READ_ROLES)];
const tenantMutate = [requireTenantScope, requireTenantMembershipRole(...MUTATE_ROLES)];
const tenantDelete = [requireTenantScope, requireTenantMembershipRole(...DELETE_ROLES)];

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

router.get('/', ...tenantRead, (req, res, next) => { req.query.type = 'vente'; return ctrl.getAll(req, res, next); });
router.get('/:id', ...tenantRead, requireContratType('vente'), ctrl.getOne);
router.put('/:id', ...tenantMutate, requireContratType('vente'), ctrl.update);
router.delete('/:id', ...tenantDelete, requireContratType('vente'), ctrl.delete);

module.exports = router;
