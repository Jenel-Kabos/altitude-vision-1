// GL-ASSET-1 — Phase 9 : contrôleur du patrimoine. Délègue entièrement aux
// services dédiés (mêmes conventions que rentalLeaseLifecycleController.js,
// DOC-EVO-1/2 dossierController.js) — aucune logique métier ici. Les
// endpoints de lecture sont ouverts au staff (STAFF_IMMO, via les routes)
// ET au propriétaire du bien (vérifié ici, même convention que
// rentalManagementController.ownerList/ownerRequest) ; seule la transition
// de cycle de vie reste strictement staff.
const mongoose = require('mongoose');
const Property = require('../models/Property');
const { ROLES_DOCS } = require('../utils/roles');
const lifecycle = require('../services/propertyAssetLifecycleService');
const { getPropertyHistory } = require('../services/propertyPatrimonialHistoryService');
const { getMaintenanceLogbook } = require('../services/propertyMaintenanceLogbookService');
const { computeValuation } = require('../services/propertyAssetValuationService');
const { computeAlerts } = require('../services/propertyAlertsService');
const { getPortfolioDashboard } = require('../services/propertyAssetPortfolioService');

const fail = (res, error) => res.status(error.statusCode || 500).json({ status: (error.statusCode || 500) >= 500 ? 'error' : 'fail', message: error.message });

async function assertReadAccess(req, propertyId) {
  if (!mongoose.isValidObjectId(propertyId)) { const e = new Error('Identifiant invalide.'); e.statusCode = 400; throw e; }
  const property = await Property.findById(propertyId).select('owner');
  if (!property) { const e = new Error('Bien introuvable.'); e.statusCode = 404; throw e; }
  const isStaff = ROLES_DOCS.includes(req.user.role);
  const isOwner = String(property.owner) === String(req.user._id || req.user.id);
  if (!isStaff && !isOwner) { const e = new Error('Accès refusé.'); e.statusCode = 403; throw e; }
}

exports.getLifecycle = async (req, res) => {
  try {
    await assertReadAccess(req, req.params.id);
    const data = await lifecycle.getAvailableTransitions(req.params.id);
    res.status(200).json({ status: 'success', data });
  } catch (error) { fail(res, error); }
};

exports.transition = async (req, res) => {
  try {
    const property = await lifecycle.transition(req.params.id, req.body.target, { actor: req.user.id, comment: req.body.comment });
    res.status(200).json({ status: 'success', data: { property } });
  } catch (error) { fail(res, error); }
};

exports.getHistory = async (req, res) => {
  try {
    await assertReadAccess(req, req.params.id);
    const history = await getPropertyHistory(req.params.id);
    res.status(200).json({ status: 'success', data: { history } });
  } catch (error) { fail(res, error); }
};

exports.getMaintenanceLogbook = async (req, res) => {
  try {
    await assertReadAccess(req, req.params.id);
    const logbook = await getMaintenanceLogbook(req.params.id);
    res.status(200).json({ status: 'success', data: { logbook } });
  } catch (error) { fail(res, error); }
};

exports.getValuation = async (req, res) => {
  try {
    await assertReadAccess(req, req.params.id);
    const valuation = await computeValuation(req.params.id);
    res.status(200).json({ status: 'success', data: { valuation } });
  } catch (error) { fail(res, error); }
};

exports.getAlerts = async (req, res) => {
  try {
    await assertReadAccess(req, req.params.id);
    const alerts = await computeAlerts(req.params.id);
    res.status(200).json({ status: 'success', data: { alerts } });
  } catch (error) { fail(res, error); }
};

// GL-ASSET-UX-1 — Phase 8 : tableau de bord portefeuille. Le staff (ROLES_DOCS)
// voit tout le patrimoine ; un propriétaire ne voit que ses propres biens
// (même filtrage que rentalManagementController.ownerList).
exports.getPortfolioDashboard = async (req, res) => {
  try {
    const isStaff = ROLES_DOCS.includes(req.user.role);
    const dashboard = await getPortfolioDashboard(isStaff ? {} : { ownerId: req.user._id || req.user.id });
    res.status(200).json({ status: 'success', data: { dashboard } });
  } catch (error) { fail(res, error); }
};
