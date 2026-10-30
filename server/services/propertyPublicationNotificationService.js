const PlatformOperator = require('../models/PlatformOperator');
const Notification = require('../models/Notification');
const { notify } = require('./notificationService');

const inFlightNotifications = new Map();

const commercial = (type, title, body) => ({ audience: 'commercial', type, title, body });
const owner = (type, title, body) => ({ audience: 'owner', type, title, body });

const PROPERTY_LIFECYCLE_NOTIFICATION_EVENTS = Object.freeze({
  submitted: commercial('property_publication_submitted', 'Nouvelle annonce à examiner', 'Une nouvelle annonce a été soumise.'),
  changed: commercial('property_publication_changed', 'Modification d’annonce à examiner', 'Une nouvelle version a été soumise.'),
  withdrawn: commercial('property_owner_withdrawn', 'Annonce retirée par le propriétaire', 'Le propriétaire a retiré son annonce.'),
  rented: commercial('property_availability_changed', 'Bien déclaré loué', 'Le propriétaire a déclaré le bien loué.'),
  sold: commercial('property_availability_changed', 'Bien déclaré vendu', 'Le propriétaire a déclaré le bien vendu.'),
  unavailable: commercial('property_availability_changed', 'Bien déclaré indisponible', 'Le propriétaire a déclaré le bien indisponible.'),
  reactivation_requested: commercial('property_reactivation_requested', 'Réactivation à examiner', 'Une nouvelle validation est requise.'),
  suspension_review_requested: commercial('property_suspension_review_requested', 'Suspension à réexaminer', 'Le propriétaire demande un réexamen.'),
  approved: owner('property_publication_approved', 'Annonce approuvée', 'Votre annonce est approuvée et publiée.'),
  rejected: owner('property_publication_rejected', 'Annonce refusée', 'Votre annonce reste non publiée.'),
  admin_suspended: owner('property_admin_suspended', 'Annonce suspendue par Altimmo', 'Votre annonce a été suspendue.'),
  suspension_lifted: owner('property_suspension_lifted', 'Suspension levée', 'La suspension est levée; une validation reste requise.'),
});

class PropertyPublicationNotificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PropertyPublicationNotificationError';
    this.code = code;
    this.statusCode = 422;
  }
}

async function commercialRecipients() {
  return PlatformOperator.find({
    status: 'active', capabilities: 'platform.commercial.manage',
  }).distinct('user');
}

async function notifyOnce(recipient, payload) {
  const key = `${recipient}:${payload.dedupeKey}`;
  if (inFlightNotifications.has(key)) return inFlightNotifications.get(key);
  const operation = (async () => {
    const existing = await Notification.findOne({ recipient, dedupeKey: payload.dedupeKey });
    return existing || notify({ ...payload, recipient });
  })();
  inFlightNotifications.set(key, operation);
  try {
    return await operation;
  } finally {
    inFlightNotifications.delete(key);
  }
}

async function notifyPropertyLifecycleEvent({ event, property, actor, reason = '', transitionKey }) {
  const definition = PROPERTY_LIFECYCLE_NOTIFICATION_EVENTS[event];
  if (!definition) {
    throw new PropertyPublicationNotificationError('PROPERTY_NOTIFICATION_EVENT_INVALID', 'Événement de notification immobilière invalide.');
  }
  const propertyId = property?._id || property?.id;
  const ownerId = property?.owner?._id || property?.owner;
  if (!propertyId || !ownerId || !transitionKey) {
    throw new PropertyPublicationNotificationError('PROPERTY_NOTIFICATION_CONTEXT_INVALID', 'Contexte de notification immobilière incomplet.');
  }
  const recipients = definition.audience === 'owner' ? [ownerId] : await commercialRecipients();
  const cleanReason = String(reason || '').trim();
  const body = cleanReason ? `${definition.body} Motif : ${cleanReason}` : definition.body;
  const results = await Promise.allSettled(recipients.map((recipient) => notifyOnce(recipient, {
    sender: actor?._id || actor?.id || actor || null,
    type: definition.type,
    title: definition.title,
    body,
    audience: definition.audience === 'commercial' ? 'staff' : 'user',
    entityType: 'Property',
    entityId: propertyId,
    data: { propertyId: String(propertyId) },
    dedupeKey: `property-lifecycle:${propertyId}:${event}:${transitionKey}`,
    platformTenantId: property.tenant || null,
  })));
  return {
    attempted: recipients.length,
    delivered: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
  };
}

module.exports = {
  PROPERTY_LIFECYCLE_NOTIFICATION_EVENTS,
  PropertyPublicationNotificationError,
  notifyPropertyLifecycleEvent,
};
