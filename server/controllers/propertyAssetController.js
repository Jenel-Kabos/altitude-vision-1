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
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');

const fail = (res, error) => res.status(error.statusCode || 500).json({ status: (error.statusCode || 500) >= 500 ? 'error' : 'fail', message: error.message });

async function assertReadAccess(req, propertyId) {
  if (!mongoose.isValidObjectId(propertyId)) { const e = new Error('Identifiant invalide.'); e.statusCode = 400; throw e; }
  const property = await Property.findById(propertyId).select('owner');
  if (!property) { const e = new Error('Bien introuvable.'); e.statusCode = 404; throw e; }
  const isStaff = ROLES_DOCS.includes(req.user.role);
  const isOwner = String(property.owner) === String(req.user._id || req.user.id);
  if (!isStaff && !isOwner) { const e = new Error('Accès refusé.'); e.statusCode = 403; throw e; }
}

// SECURITY-CLOSURE-P1-WAVE-1 (P1-G, finding RA-12) — la route
// `POST /:id/transition` exige déjà `requireCapability('properties.update')`
// = `STAFF_IMMO` : un simple `isStaff` répliquant `assertReadAccess` serait
// donc TOUJOURS vrai pour quiconque atteint ce contrôleur (la dimension
// RBAC est déjà couverte par la route) et ne fermerait rien de réel. Le
// vrai manque est la dimension tenant, absente ici alors qu'elle protège
// déjà `Property` ailleurs (TENANT-CERT-2, `propertyController.js`) : un
// staff de N'IMPORTE QUEL tenant pouvait transitionner N'IMPORTE QUEL bien.
// Même primitive canonique que P1-F, réutilisée directement.
async function assertTransitionAccess(req, propertyId) {
  if (!mongoose.isValidObjectId(propertyId)) { const e = new Error('Identifiant invalide.'); e.statusCode = 400; throw e; }
  const property = await Property.findById(propertyId).select('owner');
  if (!property) { const e = new Error('Bien introuvable.'); e.statusCode = 404; throw e; }
  const isOwner = String(property.owner) === String(req.user._id || req.user.id);
  if (isOwner) return;
  const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
  const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
  await assertResourceTenantOrUnattributed({ resourceType: 'Property', resource: property, tenantId: tenant?._id });
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
    // SECURITY-CLOSURE-P1-WAVE-1 (P1-G, finding RA-12) — seul handler de ce
    // fichier sans aucune vérification d'accès, contrairement à ses 5
    // handlers GET sœurs — alors que c'est le seul qui MUTE réellement
    // l'état du bien. Voir `assertTransitionAccess` ci-dessus pour la
    // raison de ne pas réutiliser `assertReadAccess` tel quel.
    await assertTransitionAccess(req, req.params.id);
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
// HOTFIX-PROPERTY-SALE-RENT-SEPARATION-1 — `?status=vente|location` restreint
// le dashboard Patrimoine à un seul univers métier (utilisé par les pages
// Sales/Rentals, qui montent ce widget côte à côte du portefeuille global).
// Toute autre valeur forgée par le client est ignorée (jamais un filtre
// arbitraire non prévu) — comportement identique à l'absence du paramètre.
const PORTFOLIO_DASHBOARD_STATUS_VALUES = ['vente', 'location'];

exports.getPortfolioDashboard = async (req, res) => {
  try {
    const isStaff = ROLES_DOCS.includes(req.user.role);
    const status = PORTFOLIO_DASHBOARD_STATUS_VALUES.includes(req.query.status) ? req.query.status : undefined;
    const dashboard = await getPortfolioDashboard({
      ...(isStaff ? {} : { ownerId: req.user._id || req.user.id }),
      status,
    });
    res.status(200).json({ status: 'success', data: { dashboard } });
  } catch (error) { fail(res, error); }
};
