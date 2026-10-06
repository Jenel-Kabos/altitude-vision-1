// GL-LIFE-1 — Contrôleur du cycle de vie du bail. Délègue entièrement aux
// services dédiés (rentalLeaseLifecycleService/RenewalService/
// AmendmentService/CautionService/DashboardService) — aucune logique
// métier ici, même convention que dossierController.js (DOC-EVO-1).
const mongoose = require('mongoose');
const Contrat = require('../models/Contrat');
const { assertRentalResourceInTenant, tenantRentalPropertyIds } = require('../services/platformTenant/rentalScopeService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const lifecycle = require('../services/rentalLeaseLifecycleService');
const { renewLease, previewRenewal } = require('../services/rentalLeaseRenewalService');
const { addAvenant } = require('../services/rentalLeaseAmendmentService');
const caution = require('../services/rentalLeaseCautionService');
const { getLeaseLifecycleDashboard } = require('../services/rentalLeaseDashboardService');
const { assertIndividualRentalResourceAccess } = require('../services/rentalIndividualResourceAccessService');
const { individualRentalPropertyIds } = require('../services/rentalIndividualAccessService');

const fail = (res, error) => res.status(error.statusCode || 500).json({ status: (error.statusCode || 500) >= 500 ? 'error' : 'fail', message: error.message });

// SECURITY-CLOSURE-P0-WAVE-1 (P0-D, finding RA-05) — garde `router.param('id', …)`
// identique à celui de contratRoutes.js/paiementRoutes.js (TENANT-CERT-2),
// réutilisé verbatim sur ce même modèle `Contrat`. Vit dans le contrôleur
// (et non dans le fichier de routes) pour rester un edge controller→model,
// jamais un edge route→model (catégorie de dette suivie par
// architecture:check).
exports.assertContratTenantAccessParam = async (req, res, next, contratId) => {
  try {
    if (!mongoose.isValidObjectId(contratId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const contrat = await Contrat.findById(contratId);
    if (!contrat) return res.status(404).json({ status: 'fail', message: 'Contrat introuvable.' });
    if (req.query?.scope === 'individual') {
      await assertIndividualRentalResourceAccess({ resourceType: 'Contrat', resource: contrat, userId: req.user._id || req.user.id });
      return next();
    }
    const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
    const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
    // C2.10A — cycle de vie du bail (préavis, renouvellement, caution…) :
    // frontière locative stricte Contrat.bien → Property.tenant.
    await assertRentalResourceInTenant({ resourceType: 'Contrat', resource: contrat, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Contrat introuvable.' });
  }
};

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

exports.dashboard = async (req, res) => {
  try {
    // C2.10A — agrégat borné à la population canonique du tenant sélectionné.
    const propertyIds = req.rentalScope?.mode === 'individual'
      ? await individualRentalPropertyIds(req.user._id || req.user.id)
      : await tenantRentalPropertyIds(req.platformTenant?._id);
    const dashboard = await getLeaseLifecycleDashboard({ propertyIds });
    res.status(200).json({ status: 'success', data: { dashboard } });
  } catch (error) { fail(res, error); }
};
