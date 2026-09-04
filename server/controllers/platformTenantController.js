// TENANT-CORE-1 — Contrôleur d'administration SaaS. Délègue entièrement à
// platformTenantService — aucune logique métier ici.
const asyncHandler = require('express-async-handler');
const service = require('../services/platformTenant/platformTenantService');
exports.listTenants = asyncHandler(async (req, res) => {
  const tenants = await service.listTenants({ status: req.query.status });
  res.json({ status: 'success', data: { tenants } });
});

exports.createTenant = asyncHandler(async (req, res) => {
  const tenant = await service.createTenant({ ...req.body, actor: req.user, req });
  res.status(201).json({ status: 'success', data: { tenant } });
});

exports.getTenantOverview = asyncHandler(async (req, res) => {
  const overview = await service.getTenantOverview(req.params.id);
  res.json({ status: 'success', data: { overview } });
});

exports.suspendTenant = asyncHandler(async (req, res) => {
  const tenant = await service.suspendTenant(req.params.id, { actor: req.user, reason: req.body.reason, req });
  res.json({ status: 'success', data: { tenant } });
});

exports.reactivateTenant = asyncHandler(async (req, res) => {
  const tenant = await service.reactivateTenant(req.params.id, { actor: req.user, req });
  res.json({ status: 'success', data: { tenant } });
});

exports.archiveTenant = asyncHandler(async (req, res) => {
  const tenant = await service.archiveTenant(req.params.id, { actor: req.user, req });
  res.json({ status: 'success', data: { tenant } });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const settings = await service.updateSettings(req.params.id, { ...req.body, actor: req.user });
  res.json({ status: 'success', data: { settings } });
});

exports.updateTheme = asyncHandler(async (req, res) => {
  const theme = await service.updateTheme(req.params.id, { ...req.body, actor: req.user });
  res.json({ status: 'success', data: { theme } });
});

exports.addDomain = asyncHandler(async (req, res) => {
  const domain = await service.addDomain(req.params.id, req.body);
  res.status(201).json({ status: 'success', data: { domain } });
});

exports.verifyDomain = asyncHandler(async (req, res) => {
  const domain = await service.verifyDomain(req.params.domainId, { actor: req.user });
  res.json({ status: 'success', data: { domain } });
});

exports.setFeature = asyncHandler(async (req, res) => {
  const feature = await service.setFeature(req.params.id, req.params.module, { enabled: req.body.enabled, actor: req.user });
  res.json({ status: 'success', data: { feature } });
});

exports.listFeatures = asyncHandler(async (req, res) => {
  const features = await service.listFeatures(req.params.id);
  res.json({ status: 'success', data: { features } });
});

exports.changeSubscription = asyncHandler(async (req, res) => {
  const subscription = await service.changeSubscription(req.params.id, { ...req.body, actor: req.user, req });
  res.status(201).json({ status: 'success', data: { subscription } });
});

exports.cancelSubscription = asyncHandler(async (req, res) => {
  const subscription = await service.cancelSubscription(req.params.id, { actor: req.user, reason: req.body.reason, req });
  res.json({ status: 'success', data: { subscription } });
});
