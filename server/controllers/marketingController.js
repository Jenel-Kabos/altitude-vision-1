// MARKETING-AUTOMATION-1 — Contrôleur Altcom Marketing. Délègue
// entièrement aux services (marketingSegmentService, marketingTemplateService,
// marketingCampaignService) — aucune logique métier ici.
const asyncHandler = require('express-async-handler');
const segmentService = require('../services/marketingSegmentService');
const templateService = require('../services/marketingTemplateService');
const campaignService = require('../services/marketingCampaignService');
const MarketingSend = require('../models/MarketingSend');
const tenantId = (req) => req.platformTenant._id;

// ── Segments (Phase 3) ──────────────────────────────────────────────────
exports.listSegments = asyncHandler(async (_req, res) => {
  res.json({ status: 'success', data: { segments: segmentService.listSegments() } });
});

exports.previewSegment = asyncHandler(async (req, res) => {
  const ids = await segmentService.resolveSegment(req.params.key, req.query, { tenantId: tenantId(req) });
  res.json({ status: 'success', data: { segmentKey: req.params.key, count: ids.length, sampleIds: ids.slice(0, 20) } });
});

// ── Modèles (Phase 6) ───────────────────────────────────────────────────
exports.listTemplates = asyncHandler(async (req, res) => {
  res.json({ status: 'success', data: { templates: await templateService.listActiveTemplates({ tenantId: tenantId(req) }) } });
});

exports.templateHistory = asyncHandler(async (req, res) => {
  res.json({ status: 'success', data: { history: await templateService.listTemplateHistory(req.params.family, { tenantId: tenantId(req) }) } });
});

exports.createTemplateVersion = asyncHandler(async (req, res) => {
  const template = await templateService.createTemplateVersion({ ...req.body, actor: req.user, tenantId: tenantId(req) });
  res.status(201).json({ status: 'success', data: { template } });
});

exports.activateTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.activateTemplate(req.params.id, { actor: req.user, tenantId: tenantId(req) });
  res.json({ status: 'success', data: { template } });
});

exports.previewTemplate = asyncHandler(async (req, res) => {
  const result = await templateService.previewTemplate(req.params.id, req.body.variables || {}, { tenantId: tenantId(req) });
  res.json({ status: 'success', data: result });
});

// ── Campagnes (Phase 4) ─────────────────────────────────────────────────
exports.listCampaigns = asyncHandler(async (req, res) => {
  res.json({ status: 'success', data: { campaigns: await campaignService.listCampaigns({ tenantId: tenantId(req) }) } });
});

exports.createCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.createCampaign({ ...req.body, actor: req.user, req, tenantId: tenantId(req) });
  res.status(201).json({ status: 'success', data: { campaign } });
});

exports.approveCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.approveCampaign(req.params.id, { actor: req.user, req, tenantId: tenantId(req) });
  res.json({ status: 'success', data: { campaign } });
});

exports.cancelCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.cancelCampaign(req.params.id, { actor: req.user, reason: req.body.reason, req, tenantId: tenantId(req) });
  res.json({ status: 'success', data: { campaign } });
});

exports.sendCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.sendCampaign(req.params.id, { actor: req.user, req, tenantId: tenantId(req) });
  res.json({ status: 'success', data: { campaign } });
});

// ── Journal (Phase 8) ───────────────────────────────────────────────────
exports.listSends = asyncHandler(async (req, res) => {
  const filter = { tenant: tenantId(req) };
  if (req.query.campaignId) filter.campaign = req.query.campaignId;
  if (req.query.workflowRuleId) filter.workflowRuleId = req.query.workflowRuleId;
  const sends = await MarketingSend.find(filter).sort({ createdAt: -1 }).limit(200).populate('template', 'name channel').lean();
  res.json({ status: 'success', data: { sends } });
});
