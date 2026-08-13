const express = require('express');
const mongoose = require('mongoose');
const { STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM } = require('../utils/roles');
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

const protect   = [auth.protect, auth.restrictTo(...STAFF_DOC)];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];

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

router.get('/contrat/:contratId',               protect, ctrl.getDocuments);
router.post('/bail/:contratId',                 protect, ctrl.generateBail);
router.post('/quittance/:paiementId',           protect, ctrl.generateQuittance);
router.post('/mise-en-demeure/:paiementId',     protect, ctrl.generateMiseEnDemeure);
router.post('/preavis/:contratId',              protect, ctrl.generatePreavis);
router.post('/etat-des-lieux/:contratId',       protect, ctrl.generateEtatDesLieux);
router.post('/envoyer/:contratId/:docIndex',    protect, ctrl.envoyerDocument);

module.exports = router;
