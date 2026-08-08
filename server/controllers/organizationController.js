// ORGANIZATION-1 (Phase 8) — Contrôleur d'administration. Délègue
// entièrement à organizationService — aucune logique métier ici.
const asyncHandler = require('express-async-handler');
const service = require('../services/organizationService');

const serializeUnit = (u) => ({
  id: u._id, name: u.name, type: u.type, parent: u.parent, path: u.path,
  linkedEstablishment: u.linkedEstablishment, status: u.status, createdBy: u.createdBy,
});
const serializeMembership = (m) => ({
  id: m._id, user: m.user, orgUnit: m.orgUnit, roleInUnit: m.roleInUnit, status: m.status,
  grantedBy: m.grantedBy, grantedAt: m.grantedAt,
  suspendedAt: m.suspendedAt, suspensionReason: m.suspensionReason,
  revokedAt: m.revokedAt, revocationReason: m.revocationReason,
});

exports.createOrgUnit = asyncHandler(async (req, res) => {
  const unit = await service.createOrgUnit({ ...req.body, actor: req.user, req });
  res.status(201).json({ status: 'success', data: { orgUnit: serializeUnit(unit) } });
});

exports.archiveOrgUnit = asyncHandler(async (req, res) => {
  const unit = await service.archiveOrgUnit(req.params.id, { actor: req.user, reason: req.body.reason, req });
  res.json({ status: 'success', data: { orgUnit: serializeUnit(unit) } });
});

exports.getTree = asyncHandler(async (req, res) => {
  const tree = await service.getOrgTree(req.params.id);
  res.json({ status: 'success', data: { tree } });
});

exports.listUnits = asyncHandler(async (req, res) => {
  const units = await service.listOrgUnits({ type: req.query.type, status: req.query.status });
  res.json({ status: 'success', data: { units: units.map(serializeUnit) } });
});

exports.grantMembership = asyncHandler(async (req, res) => {
  const membership = await service.grantMembership({ ...req.body, actor: req.user, req });
  res.status(201).json({ status: 'success', data: { membership: serializeMembership(membership) } });
});

exports.suspendMembership = asyncHandler(async (req, res) => {
  const membership = await service.suspendMembership({ membershipId: req.params.id, actor: req.user, reason: req.body.reason, req });
  res.json({ status: 'success', data: { membership: serializeMembership(membership) } });
});

exports.revokeMembership = asyncHandler(async (req, res) => {
  const membership = await service.revokeMembership({ membershipId: req.params.id, actor: req.user, reason: req.body.reason, req });
  res.json({ status: 'success', data: { membership: serializeMembership(membership) } });
});

exports.getUserMemberships = asyncHandler(async (req, res) => {
  const memberships = await service.getEffectiveMemberships(req.params.userId);
  res.json({ status: 'success', data: { memberships } });
});
