// ERP-CORE-1 — Contrôleur du Centre d'Administration Global. Délègue
// entièrement à erpService (Phases 3-6) — aucune agrégation ici.
//
// TENANT-CERT-2 — audit adversarial (§29 "tenant explicite hostile") :
// `orgUnitId`/`tenantId` étaient transmis à erpService/reportingService SANS
// jamais vérifier qu'ils appartiennent au tenant de l'Admin appelant — un
// Admin du Tenant A pouvait lire les KPI agrégés (CA, pipeline, occupation…)
// du Tenant B en fournissant simplement son identifiant, connu ou deviné
// (vulnérabilité confirmée par test adversarial, voir
// __tests__/tenantCert2.reporting.adversarial.mongo.integration.test.js).
// Un scope explicite non prouvé appartenir à l'acteur est désormais
// silencieusement ignoré (jamais une 500/403 qui confirmerait son
// existence) — dégrade vers l'ancien comportement par défaut plutôt que de
// faire confiance à une valeur fournie par le client, conformément au
// principe §42 : jamais `tenantId envoyé par le frontend → tenant accepté
// sans validation`.
//
// LIMITE ASSUMÉE ET DOCUMENTÉE (rapport de certification, non corrigée ce
// sprint) : SANS `orgUnitId`/`tenantId` explicite, ces endpoints restent
// une agrégation PLATEFORME ENTIÈRE (comportement hérité de REPORTING-1/
// ERP-CORE-1, antérieur à l'existence de plusieurs tenants) — un scope par
// défaut automatique sur le tenant de l'acteur est un changement de
// comportement plus large que ce correctif ponctuel, volontairement laissé
// hors périmètre pour ne pas risquer de régression sur les suites
// REPORTING-1/ERP-CORE-1 existantes sans une revue dédiée.
const asyncHandler = require('express-async-handler');
const erpService = require('../services/erp/erpService');
const { resolveRootOrgUnitId } = require('../services/platformTenant/tenantContextService');

// `orgUnitId` peut légitimement désigner une unité non-racine (business
// unit/département) DANS le tenant de l'acteur — on vérifie donc que sa
// racine, pas l'identifiant lui-même, appartient à un tenant disponible
// pour cet acteur (même logique que `assertOrgUnitInActorTenant` côté
// organizationController.js).
async function trustedScopeParams(req) {
  const { orgUnitId } = req.query;
  const activeTenant = req.platformTenant;
  const orgUnitRoot = orgUnitId ? await resolveRootOrgUnitId(orgUnitId).catch(() => null) : null;
  if (orgUnitRoot && String(orgUnitRoot) === String(activeTenant.rootOrgUnit)) return { orgUnitId, tenantId: String(activeTenant._id) };
  return { tenantId: String(activeTenant._id) };
}

const parseQuery = async (req) => ({
  user: req.user,
  dateFrom: req.query.dateFrom,
  dateTo: req.query.dateTo,
  ...(await trustedScopeParams(req)),
});

exports.getExecutiveOverview = asyncHandler(async (req, res) => {
  const params = await parseQuery(req);
  const overview = await erpService.getExecutiveOverview(params);
  overview.scope = { tenantId: params.tenantId || String(req.platformTenant._id), orgUnitId: params.orgUnitId || String(req.platformTenant.rootOrgUnit) };
  res.json({ status: 'success', data: { overview } });
});

exports.getAlerts = asyncHandler(async (req, res) => {
  const alerts = await erpService.getAlerts(await parseQuery(req));
  res.json({ status: 'success', data: { alerts } });
});

exports.getDecisionCenter = asyncHandler(async (req, res) => {
  const decisions = await erpService.getDecisionCenter(await parseQuery(req));
  res.json({ status: 'success', data: { decisions } });
});

exports.getPlatformHealth = asyncHandler(async (req, res) => {
  const health = await erpService.getPlatformHealth(await parseQuery(req));
  res.json({ status: 'success', data: { health } });
});
