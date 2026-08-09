// ERP-CORE-1 — Couche d'orchestration du Centre d'Administration Global.
// Ce service NE remplace et NE recalcule aucun des moteurs/dashboards
// existants : il appelle reportingService.getExecutiveReport() (REPORTING-1,
// déjà une agrégation de 10 domaines), organizationService (ORGANIZATION-1),
// crmCockpitService (CRM-AUTOMATION-1) et erpAlertsService (seuils, Phase 4)
// puis reforme la même donnée sous forme de vue Direction/Santé/Décisions —
// aucune nouvelle requête métier n'est introduite hors des deux exceptions
// documentées ci-dessous (croissance, santé plateforme), toutes deux basées
// sur des champs déjà réels et déjà stockés.
const User = require('../../models/User');
const CrmCustomer = require('../../models/CrmCustomer');
const MarketingCampaign = require('../../models/MarketingCampaign');
const ApiCallLog = require('../../models/ApiCallLog');
const ActionLog = require('../../models/ActionLog');
const OrgUnit = require('../../models/OrgUnit');
const OrgMembership = require('../../models/OrgMembership');
const ApiKey = require('../../models/ApiKey');
const Notification = require('../../models/Notification');
const { getExecutiveReport } = require('../reporting/reportingService');
const organizationService = require('../organizationService');
const { getCockpit } = require('../crmCockpitService');
const { evaluateAlerts } = require('./erpAlertsService');

const PACKAGE_VERSION = require('../../package.json').version;

// Seule agrégation véritablement nouvelle de ce sprint : un comptage de
// User.createdAt sur deux fenêtres de 30 jours. Aucun service existant
// n'expose de métrique de croissance (audit Phase 1) — calculée à partir
// d'un champ déjà réel et déjà indexé, jamais une valeur inventée ; si la
// période précédente est vide, la variation est explicitement `null`
// plutôt qu'une division par zéro déguisée.
async function computeGrowth() {
  const now = new Date();
  const startCurrent = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startPrevious = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const [newUsersThisMonth, newUsersPreviousMonth] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: startCurrent } }),
    User.countDocuments({ createdAt: { $gte: startPrevious, $lt: startCurrent } }),
  ]);
  const newUsersGrowthPercent = newUsersPreviousMonth > 0
    ? Math.round(((newUsersThisMonth - newUsersPreviousMonth) / newUsersPreviousMonth) * 10000) / 100
    : null;
  return { newUsersThisMonth, newUsersPreviousMonth, newUsersGrowthPercent };
}

// Résolution du scope organisationnel — réutilise organizationService tel
// quel (ORGANIZATION-1), jamais une seconde implémentation.
async function getOrganizationSummary() {
  const [units, activeMemberships] = await Promise.all([
    organizationService.listOrgUnits({}),
    OrgMembership.countDocuments({ status: 'active' }),
  ]);
  const byType = units.reduce((acc, u) => { acc[u.type] = (acc[u.type] || 0) + 1; return acc; }, {});
  return { totalUnits: units.length, byType, activeMemberships };
}

// ── Phase 3 — Vue exécutive ────────────────────────────────────────────
async function getExecutiveOverview({ user, dateFrom, dateTo, orgUnitId, tenantId } = {}) {
  const [report, growth, organisation] = await Promise.all([
    getExecutiveReport({ user, dateFrom, dateTo, orgUnitId, tenantId }),
    computeGrowth(),
    getOrganizationSummary(),
  ]);
  const alerts = await evaluateAlerts({ domains: report.domains, growth });
  return {
    generatedAt: new Date(),
    domains: report.domains,
    users: report.users,
    organisation,
    growth,
    alerts,
  };
}

// ── Phase 4 — Alertes (endpoint dédié, sans reconstruire tout le rapport
// exécutif si seules les alertes sont demandées) ───────────────────────
async function getAlerts({ user, dateFrom, dateTo, orgUnitId, tenantId } = {}) {
  const [report, growth] = await Promise.all([
    getExecutiveReport({ user, dateFrom, dateTo, orgUnitId, tenantId }),
    computeGrowth(),
  ]);
  return evaluateAlerts({ domains: report.domains, growth });
}

// ── Phase 5 — Centre de décision ───────────────────────────────────────
// Pure relecture de signaux déjà produits par crmCockpitService
// (CRM-AUTOMATION-1) et erpAlertsService — aucune nouvelle règle de gestion.
async function getDecisionCenter({ user, dateFrom, dateTo, orgUnitId, tenantId } = {}) {
  const [cockpit, alerts] = await Promise.all([
    getCockpit(),
    getAlerts({ user, dateFrom, dateTo, orgUnitId, tenantId }),
  ]);
  return {
    actionsPrioritaires: cockpit.actionsPrioritaires,
    risques: alerts.filter((a) => a.severity === 'critical' || a.severity === 'warning'),
    pointsBloquants: {
      opportunitesBloquees: cockpit.opportunitesBloquees,
      documentsManquants: cockpit.documentsManquants,
      visitesSansSuite: cockpit.visitesSansSuite,
    },
    opportunites: {
      relancesAujourdhui: cockpit.relancesAujourdhui,
      prospectsInactifs: cockpit.prospectsInactifs,
    },
    echeances: {
      contratsProchesEcheance: cockpit.contratsProchesEcheance,
      paiementsASuivre: cockpit.paiementsASuivre,
    },
  };
}

// ── Phase 6 — Santé de la plateforme ───────────────────────────────────
// Chaque module renvoie exactement 5 champs : état (dérivé d'une requête
// réelle et légère, jamais fabriqué), version (package.json, réel),
// dernière synchronisation (timestamp réel le plus récent de sa collection
// principale), alertes (comptage réel issu d'erpAlertsService, filtré par
// domaine), et `tests` — volontairement STATIQUE : exécuter une suite Jest
// depuis une requête HTTP serait un risque opérationnel et hors périmètre ;
// ce champ documente honnêtement où trouver le dernier résultat réel
// (rapport de sprint) plutôt que d'en simuler un.
const TESTS_NOTE = "Résultats réels disponibles via `npm run test:mongo`/`npm run test:unit` (serveur), `npm test` (client), `npm run test:coverage` (mobile) — non ré-exécutés en direct depuis cette API (risque opérationnel hors périmètre).";

async function moduleHealth(key, { countQuery, lastSyncQuery, alertDomains = [] }, alerts) {
  try {
    const [count, lastSync] = await Promise.all([countQuery(), lastSyncQuery()]);
    return {
      key, etat: 'operationnel', version: PACKAGE_VERSION,
      tests: TESTS_NOTE,
      derniereSynchronisation: lastSync,
      volumetrie: count,
      alertes: alerts.filter((a) => alertDomains.includes(a.domain)).length,
    };
  } catch (err) {
    return { key, etat: 'degrade', version: PACKAGE_VERSION, tests: TESTS_NOTE, derniereSynchronisation: null, volumetrie: null, alertes: null, erreur: err.message };
  }
}

async function getPlatformHealth({ user, dateFrom, dateTo, orgUnitId, tenantId } = {}) {
  const alerts = await getAlerts({ user, dateFrom, dateTo, orgUnitId, tenantId });
  const latestOf = (Model, field = 'createdAt') => async () => {
    const doc = await Model.findOne().sort({ [field]: -1 }).select(field).lean();
    return doc?.[field] || null;
  };

  const modules = await Promise.all([
    moduleHealth('crm', { countQuery: () => CrmCustomer.countDocuments(), lastSyncQuery: latestOf(CrmCustomer, 'updatedAt'), alertDomains: ['crm'] }, alerts),
    moduleHealth('marketing', { countQuery: () => MarketingCampaign.countDocuments(), lastSyncQuery: latestOf(MarketingCampaign, 'updatedAt'), alertDomains: ['marketing'] }, alerts),
    moduleHealth('finance', { countQuery: () => Promise.resolve(null), lastSyncQuery: () => Promise.resolve(null), alertDomains: ['finance', 'location'] }, alerts),
    moduleHealth('organisation', { countQuery: () => OrgUnit.countDocuments({ status: 'active' }), lastSyncQuery: latestOf(OrgUnit, 'updatedAt'), alertDomains: ['organisation'] }, alerts),
    moduleHealth('api', { countQuery: () => ApiCallLog.countDocuments(), lastSyncQuery: latestOf(ApiCallLog), alertDomains: ['api'] }, alerts),
    moduleHealth('notifications', { countQuery: () => Notification.countDocuments(), lastSyncQuery: latestOf(Notification), alertDomains: [] }, alerts),
    moduleHealth('audit', { countQuery: () => ActionLog.countDocuments(), lastSyncQuery: latestOf(ActionLog, 'date'), alertDomains: [] }, alerts),
    moduleHealth('mobile', { countQuery: () => Promise.resolve(null), lastSyncQuery: () => Promise.resolve(null), alertDomains: [] }, alerts),
  ]);
  // ApiKey.API_KEY_SCOPES sert de témoin réel que le module API existe et
  // est configuré — pas une métrique inventée, un simple accès au registre.
  const apiModule = modules.find((m) => m.key === 'api');
  if (apiModule) apiModule.scopesDisponibles = ApiKey.API_KEY_SCOPES.length;

  const mobileModule = modules.find((m) => m.key === 'mobile');
  if (mobileModule) {
    mobileModule.note = "Non instrumenté côté backend (aucune télémétrie mobile centralisée) — état non déductible depuis l'API, jamais approximé.";
    mobileModule.etat = 'non_mesure';
  }
  const financeModule = modules.find((m) => m.key === 'finance');
  if (financeModule) {
    financeModule.note = 'Aucune collection Finance transversale dédiée — voir financeReport.js (P&L consolidé hors périmètre technique).';
    financeModule.etat = 'partiel';
  }

  return { generatedAt: new Date(), modules };
}

module.exports = { getExecutiveOverview, getAlerts, getDecisionCenter, getPlatformHealth, computeGrowth, getOrganizationSummary };
