const express = require('express');
const mongoose = require('mongoose');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/gestionDocumentController');
// PLATFORM-ADMIN-CERT-1 — vulnérabilité V4 corrigée : ce routeur n'avait
// AUCUNE frontière tenant, seulement un rôle (`STAFF_DOC`). La génération de
// documents légaux (bail, quittance, mise en demeure, préavis, état des
// lieux) était donc accessible pour le Contrat/Paiement de N'IMPORTE QUEL
// tenant en connaissant son ObjectId. Même patron que paiementRoutes.js/
// contratRoutes.js : `router.param` + `assertResourceTenantOrUnattributed`.
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const { requireCapability } = require('../middleware/capabilityMiddleware');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantMembershipRoleOrPlatformCapability } = require('../middleware/tenantMembershipRoleOrPlatformCapability');

// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-8 PHASE-2A.1 (2026-09-24) — READ ONLY.
// GET /contrat/:contratId only. La chaîne router.param('contratId') →
// resolveTenantForUser + assertResourceTenantOrUnattributed est correcte
// pour PATH A (les 6 POST y restent strictement) mais laisse fail-open
// tout Contrat dont `resolveResourceTenant` retourne `unresolved` — le
// service d'attribution dérive le tenant d'un Contrat via son `bien`
// (Property) uniquement, jamais via `Contrat.tenant` direct ; un Contrat
// sans bien attribué → attribution unresolved → fail-open. Ce fail-open
// legacy est motivé par l'ownership self-service (owner Property sans
// OrgMembership) — jamais légitime pour un PlatformOperator qui n'a aucun
// rapport ownership avec la ressource. Le guard ci-dessous vérifie
// STRICTEMENT `contrat.tenant === req.platformTenant._id` UNIQUEMENT sur
// le PATH B PlatformOperator (isPlatformOperatorContext), et refuse
// fail-closed toute discordance ou tenant:null. PATH A reste intact.
const GESTION_STAFF_READ = ['Admin', 'Collaborateur', 'Secretaire'];
async function assertContratPlatformOperatorTenantScope(req, res, next) {
  if (!req.isPlatformOperatorContext) return next();
  try {
    const selectedTenantId = req.platformTenant?._id;
    if (!selectedTenantId) {
      return res.status(403).json({ status: 'fail', message: 'Contexte tenant requis (sélectionnez un tenant).' });
    }
    const contrat = await Contrat.findById(req.params.contratId).select('tenant').lean();
    if (!contrat) {
      return res.status(404).json({ status: 'fail', message: 'Contrat introuvable.' });
    }
    if (!contrat.tenant) {
      // Legacy Contrat sans attribution tenant directe : l'ownership self-
      // service qui motive le fail-open côté guardParam ne s'applique jamais
      // à un opérateur plateforme.
      return res.status(404).json({ status: 'fail', code: 'TENANT_RESOURCE_NOT_FOUND', message: 'Contrat introuvable.' });
    }
    if (String(contrat.tenant) !== String(selectedTenantId)) {
      return res.status(404).json({ status: 'fail', code: 'TENANT_RESOURCE_NOT_FOUND', message: 'Contrat introuvable.' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}


router.use(auth.protect);

const guardParam = (paramName, Model, resourceType, notFoundMessage) => async (req, res, next, id) => {
  try {
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const resource = await Model.findById(id);
    if (!resource) return res.status(404).json({ status: 'fail', message: notFoundMessage });
    const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
    const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
    await assertResourceTenantOrUnattributed({ resourceType, resource, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : notFoundMessage });
  }
};

router.param('contratId', guardParam('contratId', Contrat, 'Contrat', 'Contrat introuvable.'));
router.param('paiementId', guardParam('paiementId', Paiement, 'Paiement', 'Paiement introuvable.'));

router.get(
  '/contrat/:contratId',
  requireTenantScope,
  requireTenantMembershipRoleOrPlatformCapability({
    tenantRoles: GESTION_STAFF_READ,
    platformCapabilities: ['platform.documents.read', 'platform.documents.manage'],
  }),
  assertContratPlatformOperatorTenantScope,
  ctrl.getDocuments,
);
router.post('/bail/:contratId', requireCapability('documents.manage'), ctrl.generateBail);
router.post('/quittance/:paiementId', requireCapability('documents.manage'), ctrl.generateQuittance);
router.post('/mise-en-demeure/:paiementId', requireCapability('documents.manage'), ctrl.generateMiseEnDemeure);
router.post('/preavis/:contratId', requireCapability('documents.manage'), ctrl.generatePreavis);
router.post('/etat-des-lieux/:contratId', requireCapability('documents.manage'), ctrl.generateEtatDesLieux);
router.post('/envoyer/:contratId/:docIndex', requireCapability('documents.manage'), ctrl.envoyerDocument);

module.exports = router;
