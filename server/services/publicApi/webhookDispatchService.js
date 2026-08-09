// API-PUBLIC-1 (Phase 8) — Couche de DIFFUSION uniquement. Ne produit
// jamais un événement : consomme exclusivement ceux déjà émis par
// notify() (voir le hook additif dans services/notificationService.js,
// juste à côté de celui déjà posé par CRM-AUTOMATION-1 pour
// crmAutomationEngine — même choke point, jamais un second bus
// d'événements). Un abonnement webhook n'est déclenché que si son
// `events[]` contient le `type` de l'événement ET que ce type appartient à
// `ALLOWED_WEBHOOK_EVENTS` (jamais un événement interne diffusé par erreur).
const crypto = require('crypto');
const WebhookSubscription = require('../../models/WebhookSubscription');
const { ALLOWED_WEBHOOK_EVENTS } = require('../../models/WebhookSubscription');

function signPayload(secret, payload) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

// Volontairement sans dépendance HTTP externe supplémentaire : `fetch`
// global est disponible nativement depuis Node 20 (voir package.json
// engines) — aucune nouvelle dépendance ajoutée pour un simple POST sortant.
async function deliver(subscription, payload) {
  const signature = signPayload(subscription.secret, payload);
  try {
    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Altitude-Signature': signature },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    await WebhookSubscription.updateOne({ _id: subscription._id }, {
      $set: { lastTriggeredAt: new Date(), lastStatus: response.ok ? 'success' : 'failure', ...(response.ok ? { failureCount: 0 } : {}) },
      ...(response.ok ? {} : { $inc: { failureCount: 1 } }),
    });
  } catch {
    await WebhookSubscription.updateOne({ _id: subscription._id }, {
      $set: { lastTriggeredAt: new Date(), lastStatus: 'failure' },
      $inc: { failureCount: 1 },
    }).catch(() => {});
  }
}

// `event` : même forme que celle déjà construite dans notify() pour
// crmAutomationEngine.handleEvent — {type, entityType, entityId, metadata, ...}.
async function dispatch(event) {
  if (!event?.type || !ALLOWED_WEBHOOK_EVENTS.includes(event.type)) return;
  const platformTenantId = event.platformTenantId || event.metadata?.platformTenantId || null;
  if (!platformTenantId) return;
  const subscriptions = await WebhookSubscription.find({ tenant: platformTenantId, status: 'active', events: event.type });
  if (!subscriptions.length) return;
  const payload = { event: event.type, entityType: event.entityType || null, entityId: event.entityId || null, occurredAt: new Date().toISOString() };
  await Promise.all(subscriptions.map((sub) => deliver(sub, payload)));
}

module.exports = { dispatch, signPayload };
