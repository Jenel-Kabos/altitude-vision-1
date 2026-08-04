// GL-LIFE-1 — Contrôleur du cycle de vie du bail. Délègue entièrement aux
// services dédiés (rentalLeaseLifecycleService/RenewalService/
// AmendmentService/CautionService/DashboardService) — aucune logique
// métier ici, même convention que dossierController.js (DOC-EVO-1).
const lifecycle = require('../services/rentalLeaseLifecycleService');
const { renewLease, previewRenewal } = require('../services/rentalLeaseRenewalService');
const { addAvenant } = require('../services/rentalLeaseAmendmentService');
const caution = require('../services/rentalLeaseCautionService');
const { getLeaseLifecycleDashboard } = require('../services/rentalLeaseDashboardService');

const fail = (res, error) => res.status(error.statusCode || 500).json({ status: (error.statusCode || 500) >= 500 ? 'error' : 'fail', message: error.message });

// GL-UX-1 — permet au frontend de savoir quelles transitions sont
// actuellement légales pour CE contrat, sans jamais dupliquer la table de
// transitions côté React (voir rentalLeaseLifecycleService.getAvailableTransitions).
exports.availableTransitions = async (req, res) => {
  try {
    const data = await lifecycle.getAvailableTransitions(req.params.id);
    res.status(200).json({ status: 'success', data });
  } catch (error) { fail(res, error); }
};

// GL-UX-1 — aperçu du renouvellement (Phase 3 : "visualiser les
// modifications" avant confirmation) — aucune persistance, réutilise
// exactement la même décision automatique que POST /:id/renew.
exports.previewRenew = async (req, res) => {
  try {
    const preview = await previewRenewal(req.params.id, req.body);
    res.status(200).json({ status: 'success', data: { preview } });
  } catch (error) { fail(res, error); }
};

exports.transition = async (req, res) => {
  try {
    const contrat = await lifecycle.transition(req.params.id, req.body.target, { actor: req.user.id, comment: req.body.comment });
    res.status(200).json({ status: 'success', data: { contrat } });
  } catch (error) { fail(res, error); }
};

exports.renew = async (req, res) => {
  try {
    const result = await renewLease(req.params.id, { ...req.body, actor: req.user.id });
    res.status(200).json({ status: 'success', data: result });
  } catch (error) { fail(res, error); }
};

exports.addAvenant = async (req, res) => {
  try {
    const contrat = await addAvenant(req.params.id, { ...req.body, actor: req.user.id });
    res.status(201).json({ status: 'success', data: { contrat } });
  } catch (error) { fail(res, error); }
};

exports.encaisserCaution = async (req, res) => {
  try {
    const contrat = await caution.encaisserCaution(req.params.id, { ...req.body, actor: req.user.id });
    res.status(200).json({ status: 'success', data: { contrat } });
  } catch (error) { fail(res, error); }
};

exports.bloquerCaution = async (req, res) => {
  try {
    const contrat = await caution.bloquerCaution(req.params.id, { ...req.body, actor: req.user.id });
    res.status(200).json({ status: 'success', data: { contrat } });
  } catch (error) { fail(res, error); }
};

exports.appliquerRetenueCaution = async (req, res) => {
  try {
    const contrat = await caution.appliquerRetenue(req.params.id, { ...req.body, actor: req.user.id });
    res.status(200).json({ status: 'success', data: { contrat } });
  } catch (error) { fail(res, error); }
};

exports.restituerCaution = async (req, res) => {
  try {
    const contrat = await caution.restituerCaution(req.params.id, { ...req.body, actor: req.user.id });
    res.status(200).json({ status: 'success', data: { contrat } });
  } catch (error) { fail(res, error); }
};

exports.dashboard = async (_req, res) => {
  try {
    const dashboard = await getLeaseLifecycleDashboard();
    res.status(200).json({ status: 'success', data: { dashboard } });
  } catch (error) { fail(res, error); }
};
