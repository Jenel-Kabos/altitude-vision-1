// PLATFORM-ADMIN-1 — Administration de l'identité PlatformOperator
// elle-même. Délègue entièrement à platformOperatorService — aucune
// logique métier ici. Toute la garde d'autorisation (opérateur actif +
// capacité `platform.operators.manage`) vit dans platformOperatorRoutes.js.
const asyncHandler = require('express-async-handler');
const service = require('../services/platformOperator/platformOperatorService');

exports.listOperators = asyncHandler(async (req, res) => {
  const operators = await service.listOperators();
  res.json({ status: 'success', data: { operators } });
});

exports.getMyOperatorStatus = asyncHandler(async (req, res) => {
  const operator = await service.getOperatorByUserId(req.user._id || req.user.id);
  res.json({ status: 'success', data: { operator: operator || null } });
});

exports.grantOperator = asyncHandler(async (req, res) => {
  const { userId, capabilities, reason } = req.body;
  const operator = await service.grantOperator({ userId, capabilities, reason, actor: req.user, req });
  res.status(201).json({ status: 'success', data: { operator } });
});

exports.suspendOperator = asyncHandler(async (req, res) => {
  const operator = await service.suspendOperator({ userId: req.params.userId, reason: req.body.reason, actor: req.user, req });
  res.json({ status: 'success', data: { operator } });
});

exports.reactivateOperator = asyncHandler(async (req, res) => {
  const operator = await service.reactivateOperator({ userId: req.params.userId, reason: req.body.reason, actor: req.user, req });
  res.json({ status: 'success', data: { operator } });
});

exports.revokeOperator = asyncHandler(async (req, res) => {
  const operator = await service.revokeOperator({ userId: req.params.userId, reason: req.body.reason, actor: req.user, req });
  res.json({ status: 'success', data: { operator } });
});
