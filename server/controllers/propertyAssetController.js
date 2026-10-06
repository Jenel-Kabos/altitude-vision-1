// GL-ASSET-1 — Phase 9 : contrôleur du patrimoine. Délègue entièrement aux
// services dédiés (mêmes conventions que rentalLeaseLifecycleController.js,
// DOC-EVO-1/2 dossierController.js) — aucune logique métier ici. Les
// endpoints de lecture sont ouverts au staff (STAFF_IMMO, via les routes)
// ET au propriétaire du bien (vérifié ici, même convention que
// rentalManagementController.ownerList/ownerRequest) ; seule la transition
// de cycle de vie reste strictement staff.
const mongoose = require('mongoose');
const Property = require('../models/Property');
const lifecycle = require('../services/propertyAssetLifecycleService');
const { getPropertyHistory } = require('../services/propertyPatrimonialHistoryService');
const { getMaintenanceLogbook } = require('../services/propertyMaintenanceLogbookService');
const { computeValuation } = require('../services/propertyAssetValuationService');
const { computeAlerts } = require('../services/propertyAlertsService');
const { getPortfolioDashboard } = require('../services/propertyAssetPortfolioService');
const { resolveTenantMembership } = require('../services/tenantMembershipService');
const {
  ADMINISTRATION_SCOPE_MODE,
  assertPropertyInAdministrationScope,
} = require('../services/administrationScopeService');

const fail = (res, error) => res.status(error.statusCode || 500).json({ status: (error.statusCode || 500) >= 500 ? 'error' : 'fail', message: error.message });

const READ_TENANT_ROLES = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];
const MANAGE_TENANT_ROLES = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];

function forbidden(message = 'Accès refusé.') {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = 'PROPERTY_SCOPE_FORBIDDEN';
  return error;
}

async function hasTenantAuthority(req, roles) {
  const resolved = await resolveTenantMembership(
    req.user?._id || req.user?.id,
    req.adminScope?.tenantId,
    { allowLegacyRoleFallback: false },
  ).catch(() => null);
  return Boolean(resolved && !resolved.ambiguous && roles.includes(resolved.businessRole));
}

async function assertAdministrationAccess(req, property, { capability, tenantRoles }) {
  assertPropertyInAdministrationScope(req.adminScope, property);
  if (req.adminScope.mode === ADMINISTRATION_SCOPE_MODE.PLATFORM) {
    if (!req.platformOperatorCapabilities?.includes(capability)) throw forbidden('Capacité plateforme requise.');
    return;
  }
  if (req.adminScope.mode === ADMINISTRATION_SCOPE_MODE.TENANT) {
    const operatorAuthorized = req.platformOperator?.status === 'active'
      && req.platformOperatorCapabilities?.includes(capability);
    if (operatorAuthorized || await hasTenantAuthority(req, tenantRoles)) return;
  }
  throw forbidden();
}

async function assertReadAccess(req, propertyId) {
  if (!mongoose.isValidObjectId(propertyId)) { const e = new Error('Identifiant invalide.'); e.statusCode = 400; throw e; }
  const property = await Property.findById(propertyId).select('owner tenant');
  if (!property) { const e = new Error('Bien introuvable.'); e.statusCode = 404; throw e; }
  const isOwner = String(property.owner) === String(req.user._id || req.user.id);
  if (isOwner) return;
  await assertAdministrationAccess(req, property, {
    capability: 'platform.properties.read',
    tenantRoles: READ_TENANT_ROLES,
  });
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
  const property = await Property.findById(propertyId).select('owner tenant');
  if (!property) { const e = new Error('Bien introuvable.'); e.statusCode = 404; throw e; }
  const isOwner = String(property.owner) === String(req.user._id || req.user.id);
  if (isOwner) return;
  await assertAdministrationAccess(req, property, {
    capability: 'platform.properties.manage',
    tenantRoles: MANAGE_TENANT_ROLES,
  });
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

// Tenant portfolio: authority/context is supplied by the canonical route guards.
// Missing/invalid status keeps both business domains inside that tenant only.
const PORTFOLIO_DASHBOARD_STATUS_VALUES = ['vente', 'location'];

exports.getPortfolioDashboard = async (req, res) => {
  try {
    const status = PORTFOLIO_DASHBOARD_STATUS_VALUES.includes(req.query.status) ? req.query.status : undefined;
    const dashboard = await getPortfolioDashboard({
      tenantId: req.platformTenant?._id,
      status,
    });
    res.status(200).json({ status: 'success', data: { dashboard } });
  } catch (error) { fail(res, error); }
};
