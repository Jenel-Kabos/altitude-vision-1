// API-PUBLIC-1 (Phase 9) — Administration des clés API et webhooks côté
// staff (portail développeur). Délègue entièrement aux services —
// réutilise apiKeyService (Phase 4) sans dupliquer sa logique.
const asyncHandler = require('express-async-handler');
const apiKeyService = require('../services/publicApi/apiKeyService');
const ApiCallLog = require('../models/ApiCallLog');
const WebhookSubscription = require('../models/WebhookSubscription');

exports.listKeys = asyncHandler(async (req, res) => {
  const keys = await apiKeyService.listApiKeys({ tenant: req.platformTenant._id });
  res.json({ status: 'success', data: { keys } });
});

exports.createKey = asyncHandler(async (req, res) => {
  const { apiKey, rawKey } = await apiKeyService.createApiKey({
    ...req.body,
    tenant: req.platformTenant._id,
    actor: req.user,
  });
  // La clé en clair (`rawKey`) n'est renvoyée qu'ici, une seule fois.
  res.status(201).json({ status: 'success', data: { apiKey, rawKey } });
});

exports.revokeKey = asyncHandler(async (req, res) => {
  const apiKey = await apiKeyService.revokeApiKey(req.params.id, {
    actor: req.user, reason: req.body.reason, tenant: req.platformTenant._id,
  });
  res.json({ status: 'success', data: { apiKey } });
});

exports.rotateKey = asyncHandler(async (req, res) => {
  const { apiKey, rawKey } = await apiKeyService.rotateApiKey(req.params.id, {
    actor: req.user, reason: req.body.reason, tenant: req.platformTenant._id,
  });
  res.json({ status: 'success', data: { apiKey, rawKey } });
});

exports.getCallLogs = asyncHandler(async (req, res) => {
  const tenantKeyIds = await require('../models/ApiKey').find({ tenant: req.platformTenant._id }).distinct('_id');
  const filter = { apiKey: { $in: tenantKeyIds } };
  if (req.query.apiKeyId) {
    filter.apiKey = tenantKeyIds.some((id) => String(id) === String(req.query.apiKeyId))
      ? req.query.apiKeyId
      : { $in: [] };
  }
  if (req.query.errorsOnly === 'true') filter.statusCode = { $gte: 400 };
  const logs = await ApiCallLog.find(filter).sort({ createdAt: -1 }).limit(200).populate('apiKey', 'name keyPrefix').lean();
  res.json({ status: 'success', data: { logs } });
});

exports.getWebhookSubscriptions = asyncHandler(async (req, res) => {
  const subscriptions = await WebhookSubscription.find({ tenant: req.platformTenant._id }).select('-secret').populate('apiKey', 'name keyPrefix').sort({ createdAt: -1 }).lean();
  res.json({ status: 'success', data: { subscriptions } });
});
