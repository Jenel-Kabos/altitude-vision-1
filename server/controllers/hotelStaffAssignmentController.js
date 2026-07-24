const assignmentService = require('../services/hotel/hotelStaffAssignmentService');
const { listAccessibleHotels } = require('../services/hotel/hotelAccessScopeService');

exports.list = async (req, res, next) => { try {
  const result = await assignmentService.listHotelStaffAssignments({ hotelId: req.params.hotelId, status: req.query.status, assignmentRole: req.query.assignmentRole, page: req.query.page, limit: req.query.limit });
  res.json({ status: 'success', data: { assignments: result.items.map(assignmentService.publicAssignment), total: result.total, page: result.page, limit: result.limit } });
} catch (e) { next(e); } };

exports.create = async (req, res, next) => { try {
  const assignment = await assignmentService.createHotelStaffAssignment({
    actor: req.user, hotelId: req.params.hotelId, userId: req.body.userId, assignmentRole: req.body.assignmentRole,
    capabilities: req.body.capabilities, validFrom: req.body.validFrom, validUntil: req.body.validUntil,
  });
  res.status(201).json({ status: 'success', data: { assignment: assignmentService.publicAssignment(await assignment.populate('user', 'name email role')) } });
} catch (e) { next(e); } };

exports.get = async (req, res, next) => { try {
  const assignment = await assignmentService.getHotelStaffAssignment(req.params.assignmentId);
  res.json({ status: 'success', data: { assignment: assignmentService.publicAssignment(assignment) } });
} catch (e) { next(e); } };

exports.update = async (req, res, next) => { try {
  const assignment = await assignmentService.updateHotelStaffAssignment({ actor: req.user, assignmentId: req.params.assignmentId, capabilities: req.body.capabilities, validUntil: req.body.validUntil });
  res.json({ status: 'success', data: { assignment: assignmentService.publicAssignment(await assignment.populate('user', 'name email role')) } });
} catch (e) { next(e); } };

exports.suspend = async (req, res, next) => { try {
  const assignment = await assignmentService.suspendHotelStaffAssignment({ actor: req.user, assignmentId: req.params.assignmentId, reason: req.body.reason });
  res.json({ status: 'success', data: { assignment: assignmentService.publicAssignment(await assignment.populate('user', 'name email role')) } });
} catch (e) { next(e); } };

exports.reactivate = async (req, res, next) => { try {
  const assignment = await assignmentService.reactivateHotelStaffAssignment({ actor: req.user, assignmentId: req.params.assignmentId });
  res.json({ status: 'success', data: { assignment: assignmentService.publicAssignment(await assignment.populate('user', 'name email role')) } });
} catch (e) { next(e); } };

exports.revoke = async (req, res, next) => { try {
  const assignment = await assignmentService.revokeHotelStaffAssignment({ actor: req.user, assignmentId: req.params.assignmentId, reason: req.body.reason });
  res.json({ status: 'success', data: { assignment: assignmentService.publicAssignment(await assignment.populate('user', 'name email role')) } });
} catch (e) { next(e); } };

exports.accessibleHotels = async (req, res, next) => { try {
  const result = await listAccessibleHotels(req.user);
  res.json({ status: 'success', data: { globalAccess: result.globalAccess, hotels: result.hotels.map((h) => ({ id: h._id, name: h.name, brand: h.brand })) } });
} catch (e) { next(e); } };
