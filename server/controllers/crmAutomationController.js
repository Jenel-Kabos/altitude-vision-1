// CRM-AUTOMATION-1 (Phase 7) — Administration des règles. Délègue
// entièrement aux modèles/services existants — aucune règle codée en dur.
const asyncHandler = require('express-async-handler');
const CrmAutomationRule = require('../models/CrmAutomationRule');
const CrmAutomationRun = require('../models/CrmAutomationRun');
const { handleEvent } = require('../services/crmAutomationEngine');
const { computeCustomerScore } = require('../services/crmScoreService');
const { getCockpit } = require('../services/crmCockpitService');

exports.listRules = asyncHandler(async (req, res) => {
  const rules = await CrmAutomationRule.find({ tenant: req.platformTenant._id }).sort({ priority: 1, ruleId: 1 }).lean();
  res.json({ status: 'success', data: { rules } });
});

exports.createRule = asyncHandler(async (req, res) => {
  const rule = await CrmAutomationRule.create({ ...req.body, tenant: req.platformTenant._id, createdBy: req.user._id, updatedBy: req.user._id });
  res.status(201).json({ status: 'success', data: { rule } });
});

exports.updateRule = asyncHandler(async (req, res) => {
  const ALLOWED = ['label', 'description', 'triggerEvent', 'conditions', 'actions', 'priority', 'enabled', 'delayMinutes'];
  const updates = {};
  ALLOWED.forEach((key) => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });
  updates.updatedBy = req.user._id;
  const rule = await CrmAutomationRule.findOneAndUpdate({ _id: req.params.id, tenant: req.platformTenant._id }, updates, { new: true, runValidators: true });
  if (!rule) return res.status(404).json({ status: 'fail', message: 'Règle introuvable.' });
  res.json({ status: 'success', data: { rule } });
});

// Activer/désactiver — endpoint dédié pour un toggle rapide côté admin,
// distinct de updateRule (qui exige le payload complet des actions).
exports.setEnabled = asyncHandler(async (req, res) => {
  const rule = await CrmAutomationRule.findOneAndUpdate(
    { _id: req.params.id, tenant: req.platformTenant._id },
    { enabled: Boolean(req.body.enabled), updatedBy: req.user._id },
    { new: true },
  );
  if (!rule) return res.status(404).json({ status: 'fail', message: 'Règle introuvable.' });
  res.json({ status: 'success', data: { rule } });
});

// Simulation (Phase 7) — évalue les conditions et journalise les actions qui
// SERAIENT exécutées, sans jamais créer d'activité/opportunité/notification
// réelle. Réutilise le même moteur que l'exécution réelle (aucune logique
// de simulation parallèle).
exports.simulate = asyncHandler(async (req, res) => {
  const { type, recipient, entityType, entityId, metadata, audience } = req.body;
  if (!type || !recipient) return res.status(422).json({ status: 'fail', message: 'type et recipient sont requis pour une simulation.' });
  const results = await handleEvent({ type, recipient, sender: req.user._id, entityType, entityId, metadata: metadata || {}, audience: audience || 'staff', platformTenantId: req.platformTenant._id }, { simulate: true });
  res.json({ status: 'success', data: { results } });
});

exports.listRuns = asyncHandler(async (req, res) => {
  const filter = { tenant: req.platformTenant._id };
  if (req.query.ruleId) filter.ruleId = req.query.ruleId;
  const runs = await CrmAutomationRun.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ status: 'success', data: { runs } });
});

exports.getCustomerScore = asyncHandler(async (req, res) => {
  const score = await computeCustomerScore(req.params.customerId);
  res.json({ status: 'success', data: { score } });
});

exports.getCockpit = asyncHandler(async (_req, res) => {
  const cockpit = await getCockpit();
  res.json({ status: 'success', data: { cockpit } });
});
