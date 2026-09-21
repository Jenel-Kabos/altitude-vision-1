// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1D — controller /api/members.
// Toute la source d'autorité vient de `req.platformTenant` (canonique) +
// `req.tenantBusinessRole === 'Admin'` (requireTenantMembershipRole).
// req.body.tenant / query.tenant sont IGNORÉS.

const asyncHandler = require('express-async-handler');
const service = require('../services/tenantMemberService');

const tenantId = (req) => req.platformTenant?._id;

exports.listMembers = asyncHandler(async (req, res) => {
  const members = await service.listMembers(tenantId(req));
  res.status(200).json({ status: 'success', results: members.length, data: { members } });
});

exports.searchGlobalUser = asyncHandler(async (req, res) => {
  const user = await service.findGlobalUserByEmail(req.query.email);
  if (!user) return res.status(404).json({ status: 'fail', code: 'USER_NOT_FOUND', message: 'Utilisateur inconnu.' });
  res.status(200).json({ status: 'success', data: { user } });
});

exports.addMember = asyncHandler(async (req, res) => {
  const member = await service.addMember({
    tenantId: tenantId(req),
    userId: req.body.userId,
    email: req.body.email,
    businessRole: req.body.businessRole,
    actor: req.user,
  });
  res.status(201).json({ status: 'success', data: { member } });
});

exports.changeRole = asyncHandler(async (req, res) => {
  const member = await service.changeRole({
    tenantId: tenantId(req),
    membershipId: req.params.membershipId,
    businessRole: req.body.businessRole,
    actor: req.user,
  });
  res.status(200).json({ status: 'success', data: { member } });
});

exports.suspend = asyncHandler(async (req, res) => {
  const member = await service.suspendMember({
    tenantId: tenantId(req),
    membershipId: req.params.membershipId,
    actor: req.user,
    reason: req.body.reason,
  });
  res.status(200).json({ status: 'success', data: { member } });
});

exports.reactivate = asyncHandler(async (req, res) => {
  const member = await service.reactivateMember({
    tenantId: tenantId(req),
    membershipId: req.params.membershipId,
    actor: req.user,
  });
  res.status(200).json({ status: 'success', data: { member } });
});

exports.revoke = asyncHandler(async (req, res) => {
  const member = await service.revokeMember({
    tenantId: tenantId(req),
    membershipId: req.params.membershipId,
    actor: req.user,
    reason: req.body.reason,
  });
  res.status(200).json({ status: 'success', data: { member } });
});
