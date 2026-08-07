// CRM-AUTOMATION-1 — Registre des actions exécutables par une règle
// d'automatisation. Chaque handler réutilise exclusivement des fonctions
// CRM déjà existantes (crmService.createActivity/setOpportunityOutcome) ou
// le mécanisme de notification déjà en place (notify()) — aucune nouvelle
// écriture métier n'est inventée ici.
const CrmCustomer = require('../models/CrmCustomer');
const CrmOpportunity = require('../models/CrmOpportunity');
const { createActivity, setOpportunityOutcome } = require('./crmService');
const { notify } = require('./notificationService');

// Résout le CrmCustomer concerné par un événement — réutilise exactement la
// même clé d'identité (`identityKeys: 'user:<id>'`) que crmService.js
// construit déjà pour chaque User lors de la synchronisation ; aucune
// nouvelle règle de correspondance n'est créée.
async function resolveCustomerId(event) {
  if (event.entityType === 'crmCustomer' && event.entityId) return String(event.entityId);
  if (event.recipient) {
    const customer = await CrmCustomer.findOne({ identityKeys: `user:${event.recipient}` }).select('_id').lean();
    if (customer) return String(customer._id);
  }
  return null;
}

// L'acteur d'une action automatisée est toujours un utilisateur réel déjà
// impliqué dans l'événement source (celui qui a déclenché la notification,
// ou son destinataire à défaut) — jamais un nouveau compte technique créé
// par ce moteur.
function resolveActor(event) {
  return event.sender || event.recipient || null;
}

async function createCrmActivity(event, params = {}) {
  const customerId = await resolveCustomerId(event);
  if (!customerId) return { status: 'skipped', reason: 'no_customer_match' };
  const actor = resolveActor(event);
  if (!actor) return { status: 'skipped', reason: 'no_actor' };
  const dueAt = params.dueInMinutes ? new Date(Date.now() + params.dueInMinutes * 60000) : null;
  const activity = await createActivity(customerId, {
    type: params.type || 'tache',
    title: params.title || 'Action automatisée',
    content: params.content || '',
    dueAt,
    assignedTo: params.assignedTo || actor,
  }, actor);
  return { status: 'success', activityId: String(activity._id) };
}

async function closeOpportunityWon(event, params = {}) {
  const customerId = await resolveCustomerId(event);
  if (!customerId) return { status: 'skipped', reason: 'no_customer_match' };
  const actor = resolveActor(event);
  if (!actor) return { status: 'skipped', reason: 'no_actor' };
  const openOpportunity = await CrmOpportunity.findOne({ customer: customerId, outcome: 'open' }).sort({ updatedAt: -1 });
  // Aucune opportunité ouverte à fermer : ne jamais en fabriquer une (titre/
  // pole/valeur seraient inventés) — signalé comme "skipped", pas une erreur.
  if (!openOpportunity) return { status: 'skipped', reason: 'no_open_opportunity' };
  await setOpportunityOutcome(openOpportunity._id, { outcome: 'won', reason: params.reason || 'Contrat signé' }, actor);
  return { status: 'success', opportunityId: String(openOpportunity._id) };
}

async function createNotification(event, params = {}) {
  const recipient = params.recipient || event.recipient;
  if (!recipient) return { status: 'skipped', reason: 'no_recipient' };
  await notify({
    recipient,
    sender: resolveActor(event),
    type: params.notificationType,
    title: params.title || 'Notification automatisée',
    body: params.body || '',
    destination: params.destination || null,
    entityType: event.entityType,
    entityId: event.entityId,
    audience: params.audience || 'staff',
    metadata: { automated: true, sourceEvent: event.type },
  });
  return { status: 'success' };
}

// Clé = actionId référencé par CrmAutomationRule.actions[].actionId.
const ACTION_HANDLERS = {
  'crm.activity.create': (event, params) => createCrmActivity(event, { ...params, type: params.type || 'note' }),
  'crm.task.create': (event, params) => createCrmActivity(event, { ...params, type: 'tache' }),
  'crm.reminder.create': (event, params) => createCrmActivity(event, { ...params, type: 'rappel' }),
  'crm.opportunity.close_won': (event, params) => closeOpportunityWon(event, params),
  'crm.notification.create': (event, params) => createNotification(event, params),
};

module.exports = { ACTION_HANDLERS, resolveCustomerId, resolveActor };
