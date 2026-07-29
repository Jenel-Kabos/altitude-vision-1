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
  visite_auto_cancelled_owner: '/mes-biens/visites', visite_confirmee: '/mes-visites', visite_sur_mon_bien: '/mes-biens/visites',
  visite_demandee: '/mes-visites', visite_a_confirmer: '/mes-visites', visite_reprogrammee: '/mes-visites',
  visite_rappel: '/mes-visites', visite_en_cours: '/mes-visites', visite_terminee: '/mes-visites',
  visite_annulation_demandee: '/mes-biens/visites', visite_client_absent: '/mes-biens/visites', visite_incident: '/mes-biens/visites',
  paiement_confirme: '/mes-paiements', paiement_echoue: '/mes-paiements', payment_success: '/mes-paiements',
  payment_failed: '/mes-paiements', transaction_created: '/mes-paiements', transaction_finalized: '/mes-paiements',
  new_property: '/immobilier/annonces', bien_valide: '/immobilier/annonces', bien_rejete: '/profile',
  rental_ready_to_publish: '/mes-biens', rental_listing_published: '/mes-biens',
  rental_listing_suspended: '/mes-biens', rental_property_occupied: '/mes-biens',
  rental_exit_scheduled: '/mes-biens', rental_maintenance: '/mes-biens',
  rental_listing_submitted: '/mes-biens', rental_notice_started: '/mes-biens',
  rental_notice_acknowledged: '/mes-biens', rental_notice_cancelled: '/mes-biens',
  rental_inspection_required: '/mes-biens', rental_maintenance_started: '/mes-biens',
  rental_maintenance_completed: '/mes-biens', rental_property_available: '/mes-biens',
  rental_payment_overdue: '/mes-paiements', rental_contract_expiring: '/mes-biens',
  quote_status: '/profile', quote_response: '/profile', contrat_new: '/profile', contrat_updated: '/profile',
  account_verified: '/profile', account_suspended: '/profile', message_staff: '/messages', new_message: '/messages',
  // Sprint C — moteur de réservation hôtelière.
  hotel_reservation_pending: '/mes-hotels/reservations', hotel_reservation_confirmed: '/mes-reservations-hotel',
  hotel_reservation_rejected: '/mes-reservations-hotel', hotel_reservation_cancelled: '/mes-reservations-hotel',
  hotel_reservation_expired: '/mes-reservations-hotel',
  accommodation_reservation_pending: '/dashboard/hebergements', accommodation_reservation_confirmed: '/profile',
  accommodation_reservation_cancelled: '/profile', accommodation_reservation_checked_in: '/profile', accommodation_reservation_checked_out: '/profile',
  accommodation_arrival_reminder: '/profile', accommodation_checkin_today: '/profile', accommodation_checkout_today: '/profile',
  accommodation_payment_received: '/profile', accommodation_payment_due: '/profile', accommodation_payment_completed: '/profile',
  // Sprint E — notifications individuelles (via notify() direct, pas
  // notifyStaff) : employé assigné à une tâche/un ticket.
  housekeeping_task_assigned: '/dashboard/housekeeping', maintenance_ticket_assigned: '/dashboard/maintenance',
  // Sprint GL-B2 — assignation individuelle (notify direct, jamais notifyStaff).
  rental_maintenance_ticket_assigned: '/dashboard/gestion-locative/maintenance',
};

const STAFF_LINKS = {
  new_staff_message: '/dashboard/conversations', visite_new: '/dashboard/visites', visite_cancelled: '/dashboard/visites',
  visite_payee: '/dashboard/paiements', transaction_created: '/dashboard/transactions', quote_received: '/dashboard/quotes',
  estimation_received: '/dashboard/estimations', devis_received: '/dashboard/devis', contact_received: '/dashboard/contact-messages',
  property_pending_moderation: '/dashboard/moderation/properties', nouveau_signalement: '/dashboard/litiges',
  rental_ready_to_publish: '/dashboard/gestion-locative', rental_listing_published: '/dashboard/gestion-locative',
  rental_listing_suspended: '/dashboard/gestion-locative', rental_property_occupied: '/dashboard/gestion-locative',
  rental_exit_scheduled: '/dashboard/gestion-locative', rental_maintenance: '/dashboard/gestion-locative',
  rental_listing_submitted: '/dashboard/gestion-locative', rental_notice_started: '/dashboard/gestion-locative',
  rental_notice_acknowledged: '/dashboard/gestion-locative', rental_notice_cancelled: '/dashboard/gestion-locative',
  rental_inspection_required: '/dashboard/gestion-locative', rental_maintenance_started: '/dashboard/gestion-locative',
  rental_maintenance_completed: '/dashboard/gestion-locative', rental_property_available: '/dashboard/gestion-locative',
  rental_payment_overdue: '/dashboard/gestion-locative', rental_contract_expiring: '/dashboard/gestion-locative',
  rental_owner_request: '/dashboard/gestion-locative',
  hotel_reservation_expired_batch: '/dashboard/hotel-reservations',
  // Sprint E — housekeeping / inspection / maintenance (diffusion staff via
  // notifyStaff, jamais un individu — voir USER_LINKS pour les
  // notifications d'assignation individuelle).
  housekeeping_task_created: '/dashboard/housekeeping', housekeeping_task_completed: '/dashboard/housekeeping',
  room_inspection_failed: '/dashboard/housekeeping', room_returned_to_service: '/dashboard/housekeeping',
  maintenance_ticket_created: '/dashboard/maintenance', maintenance_ticket_resolved: '/dashboard/maintenance',
  // Sprint GL-B2 — maintenance LOCATIVE (distincte de la maintenance hôtelière ci-dessus).
  rental_maintenance_ticket_created: '/dashboard/gestion-locative/maintenance',
  rental_maintenance_ticket_resolved: '/dashboard/gestion-locative/maintenance',
};

const visitSocketEventFor = (type) => {
  if (['visite_new', 'visite_demandee'].includes(type)) return 'visite:created';
  if (type === 'visite_confirmee') return 'visite:confirmed';
  if (['visite_cancelled', 'visite_auto_cancelled', 'visite_auto_cancelled_owner'].includes(type)) return 'visite:cancelled';
  return 'visite:status_changed';
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
  dedupeKey = null,
} = {}) {
  if (!recipient) {
    throw new Error('Destinataire et contenu de notification requis.');
  }

  const id = recipient.toString();
  const resolvedMessage = message ?? body;
  const resolvedMetadata = metadata ?? data ?? {};

  // 1 — Persistance
  let notif;
  try {
    notif = await Notification.create({
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
    dedupeKey,
    });
  } catch (error) {
    if (error.code !== 11000 || !dedupeKey) throw error;
    return Notification.findOne({ recipient: id, dedupeKey });
  }

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
    if (type?.startsWith('visite_')) {
      const visiteId = entityId?.toString?.() || resolvedMetadata?.visiteId || resolvedMetadata?.params?.id || null;
      const visitPayload = {
        visiteId,
        eventType: type,
        updatedAt: notif.createdAt,
      };
      getIO().to(id).emit(visitSocketEventFor(type), visitPayload);
      getIO().to(id).emit('visite:updated', visitPayload);
    }
    if (type?.startsWith('rental_')) {
      const rentalPayload = {
        rentalManagementId: resolvedMetadata?.rentalManagementId || entityId?.toString?.() || null,
        propertyId: resolvedMetadata?.propertyId || null,
        eventType: type,
        updatedAt: notif.createdAt,
      };
      const socketEvent = type.includes('publication') || type.includes('listing')
        ? 'rental:publication_changed'
        : type.includes('maintenance')
          ? 'rental:maintenance_changed'
          : type.includes('contract')
            ? 'rental:contract_alert'
          : type.includes('payment')
            ? 'rental:payment_alert'
            : type.includes('inspection')
              ? 'rental:inspection_required'
              : 'rental:occupancy_changed';
      getIO().to(id).emit(socketEvent, rentalPayload);
      getIO().to(id).emit('rental:updated', rentalPayload);
    }
  } catch {
    // Socket non initialisé (tests unitaires, etc.) — on ignore
  }

  // 3 — Push Expo si l'utilisateur n'a pas de socket actif
  if (!isUserOnline(id)) {
    const user = await User.findById(id).select('pushToken').lean();
    if (user?.pushToken) {
      sendExpoPushNotification(user.pushToken, title, resolvedMessage, {
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

module.exports = { notify, notifyStaff, notifyMany, visitSocketEventFor };
