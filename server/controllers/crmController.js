const asyncHandler = require('express-async-handler');
const crm = require('../services/crmService');

exports.sync = asyncHandler(async (req, res) => res.json({ status: 'success', data: { synchronization: await crm.synchronizeCustomers(req.user._id) } }));
exports.listCustomers = asyncHandler(async (req, res) => res.json({ status: 'success', data: await crm.listCustomers(req.query) }));
exports.getCustomer = asyncHandler(async (req, res) => res.json({ status: 'success', data: await crm.getCustomer360(req.params.customerId) }));
exports.createOpportunity = asyncHandler(async (req, res) => res.status(201).json({ status: 'success', data: { opportunity: await crm.createOpportunity(req.params.customerId, req.body, req.user._id) } }));
exports.moveOpportunity = asyncHandler(async (req, res) => res.json({ status: 'success', data: { opportunity: await crm.moveOpportunity(req.params.opportunityId, req.body, req.user._id) } }));
exports.createActivity = asyncHandler(async (req, res) => res.status(201).json({ status: 'success', data: { activity: await crm.createActivity(req.params.customerId, req.body, req.user._id) } }));
exports.updateActivity = asyncHandler(async (req, res) => res.json({ status: 'success', data: { activity: await crm.updateActivity(req.params.activityId, req.body, req.user._id) } }));
