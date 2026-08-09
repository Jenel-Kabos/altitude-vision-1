// ERP-CORE-1 — Contrôleur du Centre d'Administration Global. Délègue
// entièrement à erpService (Phases 3-6) — aucune agrégation ici.
const asyncHandler = require('express-async-handler');
const erpService = require('../services/erp/erpService');

const parseQuery = (req) => ({
  user: req.user,
  dateFrom: req.query.dateFrom,
  dateTo: req.query.dateTo,
  orgUnitId: req.query.orgUnitId,
  tenantId: req.query.tenantId, // TENANT-CORE-1 — alias pratique, résolu vers orgUnitId par reportingService
});

exports.getExecutiveOverview = asyncHandler(async (req, res) => {
  const overview = await erpService.getExecutiveOverview(parseQuery(req));
  res.json({ status: 'success', data: { overview } });
});

exports.getAlerts = asyncHandler(async (req, res) => {
  const alerts = await erpService.getAlerts(parseQuery(req));
  res.json({ status: 'success', data: { alerts } });
});

exports.getDecisionCenter = asyncHandler(async (req, res) => {
  const decisions = await erpService.getDecisionCenter(parseQuery(req));
  res.json({ status: 'success', data: { decisions } });
});

exports.getPlatformHealth = asyncHandler(async (req, res) => {
  const health = await erpService.getPlatformHealth(parseQuery(req));
  res.json({ status: 'success', data: { health } });
});
