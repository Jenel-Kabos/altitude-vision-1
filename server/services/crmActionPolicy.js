// LOT E — Classification FERMÉE des actions d'automatisation CRM.
//
// Les règles d'automatisation sont toujours rattachées à un tenant
// (crmAutomationEngine ignore tout événement sans tenant). Une action
// marketing y consommerait le consentement d'Altitude Vision au profit d'une
// organisation cliente : interdit (spec §7.3). Seules les actions
// opérationnelles explicitement listées ici sont exécutables ; tout le reste
// échoue fermé, quel que soit l'auteur de l'événement.
const OPERATIONAL_ACTIONS = new Set([
  'crm.activity.create',
  'crm.task.create',
  'crm.reminder.create',
  'crm.opportunity.close_won',
]);

const MARKETING_ACTIONS = new Set(['marketing.message.send']);

const MARKETING_PURPOSES = new Set(['marketing', 'commercial', 'promotion', 'promotional']);

function classifyCrmAction(actionId, params = {}) {
  const id = String(actionId || '');
  if (OPERATIONAL_ACTIONS.has(id)) return 'operational';
  if (MARKETING_ACTIONS.has(id)) return 'marketing';
  if (id === 'crm.notification.create') {
    const purpose = String(params?.purpose || '').toLowerCase();
    const audience = String(params?.audience || 'staff').toLowerCase();
    // Seule une notification interne au staff du tenant est opérationnelle ;
    // toute notification adressée à un utilisateur final, ou à finalité
    // commerciale, relève du marketing.
    return audience === 'staff' && !MARKETING_PURPOSES.has(purpose) ? 'operational' : 'marketing';
  }
  return 'denied_outbound_unknown';
}

class CrmActionPolicyError extends Error {
  constructor(code, actionId) {
    super(`${code}:${actionId}`);
    this.name = 'CrmActionPolicyError';
    this.code = code;
    this.actionId = actionId;
    this.statusCode = 403;
  }
}

// Point unique utilisé à l'enregistrement d'une règle ET juste avant chaque
// exécution d'action.
function assertTenantAutomationAction(actionId, params = {}) {
  const classification = classifyCrmAction(actionId, params);
  if (classification === 'operational') return classification;
  throw new CrmActionPolicyError(
    classification === 'marketing' ? 'CRM_MARKETING_ACTION_FORBIDDEN' : 'CRM_OUTBOUND_ACTION_NOT_ALLOWED',
    actionId,
  );
}

module.exports = {
  classifyCrmAction,
  assertTenantAutomationAction,
  CrmActionPolicyError,
  OPERATIONAL_ACTIONS,
  MARKETING_ACTIONS,
};
