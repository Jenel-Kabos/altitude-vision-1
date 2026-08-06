const asyncHandler = require('express-async-handler');
const crm = require('../services/crmService');

exports.sync = asyncHandler(async (req, res) => res.json({ status: 'success', data: { synchronization: await crm.synchronizeCustomers(req.user._id) } }));
exports.listCustomers = asyncHandler(async (req, res) => res.json({ status: 'success', data: await crm.listCustomers(req.query) }));
exports.getCustomer = asyncHandler(async (req, res) => res.json({ status: 'success', data: await crm.getCustomer360(req.params.customerId) }));
exports.createOpportunity = asyncHandler(async (req, res) => res.status(201).json({ status: 'success', data: { opportunity: await crm.createOpportunity(req.params.customerId, req.body, req.user._id) } }));
exports.moveOpportunity = asyncHandler(async (req, res) => res.json({ status: 'success', data: { opportunity: await crm.moveOpportunity(req.params.opportunityId, req.body, req.user._id) } }));
exports.createActivity = asyncHandler(async (req, res) => res.status(201).json({ status: 'success', data: { activity: await crm.createActivity(req.params.customerId, req.body, req.user._id) } }));
exports.updateActivity = asyncHandler(async (req, res) => res.json({ status: 'success', data: { activity: await crm.updateActivity(req.params.activityId, req.body, req.user._id) } }));
exports.dashboard = asyncHandler(async (_req, res) => res.json({ status: 'success', data: await crm.getDashboard() }));
exports.pipeline = asyncHandler(async (_req, res) => res.json({ status: 'success', data: await crm.getPipeline() }));
exports.activities = asyncHandler(async (req, res) => res.json({ status: 'success', data: await crm.getActivities(req.query) }));
exports.search = asyncHandler(async (req, res) => res.json({ status: 'success', data: await crm.globalSearch(req.query.q) }));
exports.duplicates = asyncHandler(async (req, res) => res.json({ status: 'success', data: await crm.findDuplicates(req.query) }));
exports.compare = asyncHandler(async (req, res) => res.json({ status: 'success', data: await crm.compareCustomers(req.params.customerA, req.params.customerB) }));
exports.consolidate = asyncHandler(async (req, res) => res.status(201).json({ status: 'success', data: { consolidation: await crm.consolidateCustomers(req.body, req.user._id) } }));
exports.consolidations = asyncHandler(async (_req, res) => res.json({ status: 'success', data: { consolidations: await crm.listConsolidations() } }));
exports.setOpportunityOutcome = asyncHandler(async (req, res) => res.json({ status: 'success', data: { opportunity: await crm.setOpportunityOutcome(req.params.opportunityId, req.body, req.user._id) } }));
