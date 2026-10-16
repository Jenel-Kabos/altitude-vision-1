const asyncHandler = require('express-async-handler');
const service = require('../services/contactAuthorizationService');

exports.grant = asyncHandler(async (req, res) => {
  const authorization = await service.grantAuthorization({ ...req.body, actor: req.user, req });
  res.status(201).json({ status: 'success', data: { authorization: service.serializeContactAuthorization(authorization) } });
});

exports.list = asyncHandler(async (req, res) => {
  const authorizations = await service.listAuthorizations({ actor: req.user, tenantId: req.query.tenantId, status: req.query.status });
  res.json({ status: 'success', results: authorizations.length, data: { authorizations: authorizations.map(service.serializeContactAuthorization) } });
});

exports.getOne = asyncHandler(async (req, res) => {
  const requestedTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id');
  const authorization = await service.getAuthorizationForViewer({ authorizationId: req.params.id, viewer: req.user, requestedTenantId });
  if (!authorization) {
    res.status(404);
    throw new Error('Autorisation de contact introuvable.');
  }
  res.json({ status: 'success', data: { authorization: service.serializeContactAuthorization(authorization) } });
});

exports.revoke = asyncHandler(async (req, res) => {
  const authorization = await service.revokeAuthorization({ authorizationId: req.params.id, actor: req.user, reason: req.body.reason, req });
  res.json({ status: 'success', data: { authorization: service.serializeContactAuthorization(authorization) } });
});

