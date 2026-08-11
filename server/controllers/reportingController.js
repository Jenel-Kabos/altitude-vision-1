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
const { resolveAvailableTenantsForUser, resolveRootOrgUnitId } = require('../services/platformTenant/tenantContextService');

async function scopeParams(req) {
  const { orgUnitId, tenantId } = req.query;
  if (!orgUnitId && !tenantId) return { orgUnitId: undefined, tenantId: undefined };
  const available = await resolveAvailableTenantsForUser(req.user._id || req.user.id).catch(() => []);
  const availableRootIds = new Set((available || []).map((t) => String(t.rootOrgUnit)));
  const availableTenantIds = new Set((available || []).map((t) => String(t._id)));
  const orgUnitRoot = orgUnitId ? await resolveRootOrgUnitId(orgUnitId).catch(() => null) : null;
  return {
    orgUnitId: orgUnitRoot && availableRootIds.has(orgUnitRoot) ? orgUnitId : undefined,
    tenantId: tenantId && availableTenantIds.has(String(tenantId)) ? tenantId : undefined,
  };
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
