/**
 * notificationService.js — Dispatcher centralisé de notifications
 *
 * Chaque notification passe par notify() qui :
 *   1. Crée un enregistrement persistant en base (Notification model)
 *   2. Émet un événement Socket.IO temps réel vers la room privée du destinataire
 *   3. Envoie une push Expo si l'utilisateur est hors-ligne (pas de socket actif)
 *
 * Usage dans un controller :
 *   const { notify, notifyStaff } = require('../services/notificationService');
 *   await notify({ recipient, type, title, message, link, metadata });
 */

const User         = require('../models/User');
const Notification = require('../models/Notification');
const { getIO, isUserOnline }         = require('../socket');
const { sendExpoPushNotification }    = require('../utils/expoPush');
const { ALL_STAFF }                   = require('../utils/roles');

const USER_LINKS = {
  visite_status: '/mes-visites', visite_cancelled: '/mes-visites', visite_auto_cancelled: '/mes-visites',
  visite_auto_cancelled_owner: '/mes-visites', visite_confirmee: '/mes-visites', visite_sur_mon_bien: '/mes-visites',
  paiement_confirme: '/mes-paiements', paiement_echoue: '/mes-paiements', payment_success: '/mes-paiements',
  payment_failed: '/mes-paiements', transaction_created: '/mes-paiements', transaction_finalized: '/mes-paiements',
  new_property: '/immobilier/annonces', bien_valide: '/immobilier/annonces', bien_rejete: '/profile',
  quote_status: '/profile', quote_response: '/profile', contrat_new: '/profile', contrat_updated: '/profile',
  account_verified: '/profile', account_suspended: '/profile', message_staff: '/messages', new_message: '/messages',
};

const STAFF_LINKS = {
  new_staff_message: '/dashboard/conversations', visite_new: '/dashboard/visites', visite_cancelled: '/dashboard/visites',
  visite_payee: '/dashboard/paiements', transaction_created: '/dashboard/transactions', quote_received: '/dashboard/quotes',
  estimation_received: '/dashboard/estimations', devis_received: '/dashboard/devis', contact_received: '/dashboard/contact-messages',
  property_pending_moderation: '/dashboard/moderation/properties', nouveau_signalement: '/dashboard/litiges',
};

/**
 * Notifie un utilisateur unique.
 *
 * @param {string|ObjectId} recipientId
 * @param {{ type: string, title: string, body: string, data?: object }} payload
 * @returns {Promise<Notification>} la notification créée
 */
async function notify({
  recipient,
  sender = null,
  type,
  title,
  message,
  link,
  entityType = null,
  entityId = null,
  metadata,
  // Compatibilité de données avec les producteurs et clients mobiles existants.
  body,
  data,
} = {}) {
  if (!recipient) {
    throw new Error('Destinataire et contenu de notification requis.');
  }

  const id = recipient.toString();
  const resolvedMessage = message ?? body;
  const resolvedMetadata = metadata ?? data ?? {};

  // 1 — Persistance
  const notif = await Notification.create({
    recipient: id,
    sender,
    type,
    title,
    body: resolvedMessage,
    link: link ?? USER_LINKS[type] ?? null,
    entityType,
    entityId,
    metadata: resolvedMetadata,
    data: resolvedMetadata,
  });

  // 2 — Temps réel Socket.IO (la room = userId, configurée dans socket.js)
  try {
    getIO().to(id).emit('notification', {
      _id:       notif._id,
      type,
      title,
      body: resolvedMessage,
      link: link ?? USER_LINKS[type] ?? null,
      metadata: resolvedMetadata,
      read:      false,
      createdAt: notif.createdAt,
    });
  } catch {
    // Socket non initialisé (tests unitaires, etc.) — on ignore
  }

  // 3 — Push Expo si l'utilisateur n'a pas de socket actif
  if (!isUserOnline(id)) {
    const user = await User.findById(id).select('pushToken').lean();
    if (user?.pushToken) {
      sendExpoPushNotification(user.pushToken, title, body, {
      ...resolvedMetadata,
        notificationId: notif._id.toString(),
        type,
      });
    }
  }

  return notif;
}

/**
 * Notifie tous les membres du staff (ALL_STAFF — Admin + tous les sous-rôles collaborateurs).
 *
 * @param {{ type: string, title: string, body: string, data?: object }} payload
 * @returns {Promise<void>}
 */
async function notifyStaff(payload) {
  const staffMembers = await User.find({
    role:     { $in: ALL_STAFF },
    isActive: true,
    status:   { $nin: ['Suspendu', 'Banni'] },
  }).select('_id').lean();

  await Promise.allSettled(
    staffMembers.map((s) => notify({ ...payload, link: payload.link ?? STAFF_LINKS[payload.type] ?? null, recipient: s._id })),
  );
}

/**
 * Notifie plusieurs utilisateurs avec le même payload.
 */
async function notifyMany(recipientIds, payload) {
  await Promise.allSettled(recipientIds.map((id) => notify({ ...payload, recipient: id })));
}

module.exports = { notify, notifyStaff, notifyMany };
