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
 *   await notify(userId, { type: 'visite_status', title: '...', body: '...', data: {} });
 */

const User         = require('../models/User');
const Notification = require('../models/Notification');
const { getIO, isUserOnline }         = require('../socket');
const { sendExpoPushNotification }    = require('../utils/expoPush');
const { ALL_STAFF }                   = require('../utils/roles');

/**
 * Notifie un utilisateur unique.
 *
 * @param {string|ObjectId} recipientId
 * @param {{ type: string, title: string, body: string, data?: object }} payload
 * @returns {Promise<Notification>} la notification créée
 */
async function notify(recipientId, { type, title, body, data = {} }) {
  const id = recipientId.toString();

  // 1 — Persistance
  const notif = await Notification.create({
    recipient: id,
    type,
    title,
    body,
    data,
  });

  // 2 — Temps réel Socket.IO (la room = userId, configurée dans socket.js)
  try {
    getIO().to(id).emit('notification', {
      _id:       notif._id,
      type,
      title,
      body,
      data,
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
        ...data,
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
async function notifyStaff({ type, title, body, data = {} }) {
  const staffMembers = await User.find({
    role:     { $in: ALL_STAFF },
    isActive: true,
    status:   { $nin: ['Suspendu', 'Banni'] },
  }).select('_id').lean();

  await Promise.allSettled(
    staffMembers.map((s) => notify(s._id, { type, title, body, data })),
  );
}

/**
 * Notifie plusieurs utilisateurs avec le même payload.
 */
async function notifyMany(recipientIds, payload) {
  await Promise.allSettled(recipientIds.map((id) => notify(id, payload)));
}

module.exports = { notify, notifyStaff, notifyMany };
