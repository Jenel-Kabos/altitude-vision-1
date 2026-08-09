// CRM-AUTOMATION-1 — Moteur d'automatisation générique.
//
//   Événement métier (Notification déjà émise par un domaine existant)
//           │
//           ▼
//   crmAutomationEngine.handleEvent()
//           │  (registre CrmAutomationRule, jamais de `if` en dur)
//           ▼
//   crmAutomationActions.ACTION_HANDLERS[actionId]
//           │  (réutilise crmService.createActivity / setOpportunityOutcome / notify)
//           ▼
//   Activité CRM · Tâche · Rappel · Notification · Timeline (déjà agrégée
//   par le dossier CRM existant — aucune écriture supplémentaire requise)
//
// Ce moteur NE CRÉE JAMAIS un événement métier : il est invoqué uniquement
// depuis notificationService.notify(), le point de passage unique déjà
// emprunté par ~50 producteurs à travers GL, Hôtel, Accommodation,
// Property/Transaction, Finance et CRM (voir audit Phase 1). Aucune
// modification n'a été nécessaire dans ces domaines pour les observer.
const CrmAutomationRule = require('../models/CrmAutomationRule');
const CrmAutomationRun = require('../models/CrmAutomationRun');
const { ACTION_HANDLERS } = require('./crmAutomationActions');

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function evaluateCondition(event, condition) {
  const actual = getPath(event, condition.field);
  switch (condition.op) {
    case 'eq': return actual === condition.value;
    case 'ne': return actual !== condition.value;
    case 'in': return Array.isArray(condition.value) && condition.value.includes(actual);
    case 'exists': return actual !== undefined && actual !== null;
    default: return false;
  }
}

function matchesConditions(event, conditions = []) {
  return conditions.every((c) => evaluateCondition(event, c));
}

// `event` : { type, recipient, sender, entityType, entityId, metadata,
// audience, dedupeKey, notificationId } — forme exacte du payload déjà
// construit par notify() (voir notificationService.js).
async function handleEvent(event, { simulate = false } = {}) {
  if (!event?.type || !event.platformTenantId) return [];
  const tenant = event.platformTenantId;
  const rules = await CrmAutomationRule.find({ tenant, triggerEvent: event.type, enabled: true }).sort({ priority: 1 }).lean();
  const results = [];
  for (const rule of rules) {
    if (!matchesConditions(event, rule.conditions)) {
      results.push({ ruleId: rule.ruleId, status: 'skipped', reason: 'conditions_not_met' });
      continue;
    }
    if (simulate) {
      const run = await CrmAutomationRun.create({
        tenant, rule: rule._id, ruleId: rule.ruleId, triggerEvent: event.type,
        entityType: event.entityType || null, entityId: event.entityId || null,
        status: 'simulated', simulated: true, actionsRun: rule.actions.map((a) => a.actionId),
      });
      results.push({ ruleId: rule.ruleId, status: 'simulated', runId: String(run._id), actions: rule.actions.map((a) => a.actionId) });
      continue;
    }
    const actionsRun = [];
    let status = 'success';
    let error = null;
    try {
      for (const action of rule.actions) {
        const handler = ACTION_HANDLERS[action.actionId];
        if (!handler) { actionsRun.push(`${action.actionId}:unknown_action`); continue; }
        // rule.delayMinutes pilote le délai des actions rappel/tâche tant
        // qu'un délai n'est pas explicitement fixé par l'action elle-même —
        // permet à l'administration (Phase 7) de régler UN seul champ par
        // règle plutôt que de rouvrir chaque action.
        const params = { ...(action.params || {}) };
        if (params.dueInMinutes === undefined && rule.delayMinutes) params.dueInMinutes = rule.delayMinutes;
        const outcome = await handler(event, params);
        actionsRun.push(`${action.actionId}:${outcome?.status || 'done'}`);
      }
    } catch (e) {
      status = 'error';
      error = e.message;
    }
    // Le journal d'exécution ne doit jamais faire échouer l'automatisation
    // elle-même — même convention que l'audit trail USER-ARCH-1.
    const run = await CrmAutomationRun.create({
      tenant, rule: rule._id, ruleId: rule.ruleId, triggerEvent: event.type,
      entityType: event.entityType || null, entityId: event.entityId || null,
      status, actionsRun, error,
    }).catch(() => null);
    results.push({ ruleId: rule.ruleId, status, runId: run ? String(run._id) : null, actionsRun });
  }
  return results;
}

module.exports = { handleEvent, matchesConditions, evaluateCondition };
