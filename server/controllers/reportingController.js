// REPORTING-1 — Contrôleur du Centre de Pilotage. Délègue entièrement à
// reportingService/reportingExportService — aucun calcul ici.
// ORGANIZATION-1 (Phase 9) — `orgUnitId` optionnel, simple passthrough.
// TENANT-CORE-1 (Phase 7) — `tenantId` optionnel, également un simple
// passthrough (résolu vers `orgUnitId` en interne par reportingService).
//
// TENANT-CERT-2 — audit adversarial (§29 "tenant explicite hostile") : même
// correctif qu'erpController.js — `orgUnitId`/`tenantId` sont désormais
// vérifiés contre les tenants réellement disponibles pour l'acteur avant
// transmission, jamais transmis tels quels. Un scope non prouvé est
// silencieusement ignoré (dégradation vers le comportement par défaut,
// jamais une erreur qui confirmerait son existence). Limite assumée
// identique à erpController.js : sans scope explicite, ces endpoints
// restent une agrégation plateforme entière — voir rapport de
// certification, section « limites ».
const asyncHandler = require('express-async-handler');
const { getExecutiveReport, getDomainReport, DOMAINS } = require('../services/reporting/reportingService');
const { buildCsv, buildPdf } = require('../services/reporting/reportingExportService');
const { resolveRootOrgUnitId } = require('../services/platformTenant/tenantContextService');

// PLATFORM-ADMIN-1 — un PlatformOperator sans tenant sélectionné
// (`req.isPlatformOperatorContext` vrai ET `req.platformTenant` absent) est
// la SEULE situation où `tenantId` reste volontairement `undefined` :
// `reportingService.js` supporte nativement ce mode consolidé (paramètre
// déjà optionnel partout, voir PLATFORM_ADMIN_1_AUDIT.md §1.6) — aucune
// agrégation n'est fabriquée ici, seul le passthrough déjà existant est
// débloqué pour un acteur dont la capacité vient d'être vérifiée par
// `requireTenantScope`. Un opérateur AYANT sélectionné un tenant, et tout
// utilisateur non-opérateur, gardent le comportement forcé historique
// (jamais un `orgUnitId`/`tenantId` client de confiance).
async function scopeParams(req) {
  const { orgUnitId } = req.query;
  const activeTenant = req.platformTenant;
  if (!activeTenant) {
    if (req.isPlatformOperatorContext) return {};
    // Ne devrait jamais arriver (requireTenantScope aurait déjà 403), mais
    // ne jamais retomber sur un scope global par défaut si ce n'est pas le cas.
    const error = new Error('Contexte tenant requis.');
    error.statusCode = 403;
    throw error;
  }
  const orgUnitRoot = orgUnitId ? await resolveRootOrgUnitId(orgUnitId).catch(() => null) : null;
  if (orgUnitRoot && String(orgUnitRoot) === String(activeTenant.rootOrgUnit)) return { orgUnitId, tenantId: String(activeTenant._id) };
  // L'absence de scope et tout identifiant hostile retombent TOUJOURS sur
  // le tenant courant résolu par le middleware, jamais sur le global.
  return { tenantId: String(activeTenant._id) };
}

exports.getExecutive = asyncHandler(async (req, res) => {
  const report = await getExecutiveReport({ user: req.user, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo, ...(await scopeParams(req)) });
  res.json({ status: 'success', data: { report } });
});

exports.getDomain = asyncHandler(async (req, res) => {
  if (!DOMAINS.includes(req.params.domain)) return res.status(404).json({ status: 'fail', message: 'Domaine de reporting inconnu.' });
  const report = await getDomainReport(req.params.domain, { user: req.user, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo, ...(await scopeParams(req)) });
  res.json({ status: 'success', data: { report } });
});

exports.exportPdf = asyncHandler(async (req, res) => {
  const report = await getExecutiveReport({ user: req.user, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo, ...(await scopeParams(req)) });
  const buffer = await buildPdf(report);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="centre-pilotage-${Date.now()}.pdf"`);
  res.send(buffer);
});

exports.exportCsv = asyncHandler(async (req, res) => {
  const report = await getExecutiveReport({ user: req.user, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo, ...(await scopeParams(req)) });
  const csv = buildCsv(report);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="centre-pilotage-${Date.now()}.csv"`);
  res.send(csv);
});
