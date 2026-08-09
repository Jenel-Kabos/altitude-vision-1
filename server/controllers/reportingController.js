// REPORTING-1 — Contrôleur du Centre de Pilotage. Délègue entièrement à
// reportingService/reportingExportService — aucun calcul ici.
// ORGANIZATION-1 (Phase 9) — `orgUnitId` optionnel, simple passthrough.
// TENANT-CORE-1 (Phase 7) — `tenantId` optionnel, également un simple
// passthrough (résolu vers `orgUnitId` en interne par reportingService).
const asyncHandler = require('express-async-handler');
const { getExecutiveReport, getDomainReport, DOMAINS } = require('../services/reporting/reportingService');
const { buildCsv, buildPdf } = require('../services/reporting/reportingExportService');

const scopeParams = (req) => ({ orgUnitId: req.query.orgUnitId, tenantId: req.query.tenantId });

exports.getExecutive = asyncHandler(async (req, res) => {
  const report = await getExecutiveReport({ user: req.user, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo, ...scopeParams(req) });
  res.json({ status: 'success', data: { report } });
});

exports.getDomain = asyncHandler(async (req, res) => {
  if (!DOMAINS.includes(req.params.domain)) return res.status(404).json({ status: 'fail', message: 'Domaine de reporting inconnu.' });
  const report = await getDomainReport(req.params.domain, { user: req.user, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo, ...scopeParams(req) });
  res.json({ status: 'success', data: { report } });
});

exports.exportPdf = asyncHandler(async (req, res) => {
  const report = await getExecutiveReport({ user: req.user, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo, ...scopeParams(req) });
  const buffer = await buildPdf(report);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="centre-pilotage-${Date.now()}.pdf"`);
  res.send(buffer);
});

exports.exportCsv = asyncHandler(async (req, res) => {
  const report = await getExecutiveReport({ user: req.user, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo, ...scopeParams(req) });
  const csv = buildCsv(report);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="centre-pilotage-${Date.now()}.csv"`);
  res.send(csv);
});
