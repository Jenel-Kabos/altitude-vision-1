// server/services/hotelReservationService.js — Sprint C
//
// Cycle de vie complet d'une HotelReservation : tarification serveur
// (jamais confiance au total envoyé par le client), transitions de statut
// centralisées (jamais dans les contrôleurs), historisation, notifications.
// Toute opération qui touche l'inventaire délègue à hotelAvailabilityService
// — aucune logique de stock dupliquée ici.

const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const HotelReservation = require('../models/HotelReservation');
const {
  assertNotPast, assertAvailability, reserveInventory, releaseInventory, getNightDates,
} = require('./hotelAvailabilityService');
const { notify } = require('./notificationService');
const logger = require('../utils/logger');

// Durée par défaut avant expiration d'une demande 'pending' — volontairement
// simple (mission §11 : "ne pas créer un système complexe"). Documentée
// dans HOTEL_RESERVATIONS_V1.md, ajustable sans migration (pas de valeur
// figée en base, recalculée à la création).
const PENDING_EXPIRY_HOURS = 48;

// ─────────────────────────────────────────────
// Tarification — toujours recalculée côté serveur (mission §6)
// ─────────────────────────────────────────────

/**
 * @returns {Promise<{unitPrice, subtotal, taxes, fees, discount, totalAmount, currency, rateSnapshot}>}
 */
async function computeReservationPricing({ roomCategoryId, ratePlanId, nights, roomsCount }) {
  const rate = await RatePlan.findOne({ _id: ratePlanId, roomCategory: roomCategoryId, active: true });
  if (!rate) {
    const err = new Error("Le tarif sélectionné n'est plus disponible pour cette catégorie.");
    err.statusCode = 422;
    throw err;
  }
  const unitPrice = rate.amount;
  const subtotal = unitPrice * nights * roomsCount;
  // Taxes/frais/remise : aucune structure de taxation ou de code promo
  // n'existe ailleurs dans ce codebase à ce jour (confirmé par l'audit
  // initial — voir HOTEL_RESERVATIONS_V1.md §"Tarification") — conservés à
  // zéro plutôt que d'inventer une règle métier non demandée.
  const taxes = 0;
  const fees = 0;
  const discount = 0;
  const totalAmount = subtotal + taxes + fees - discount;
  return {
    unitPrice, subtotal, taxes, fees, discount, totalAmount,
    currency: rate.currency,
    rateSnapshot: { rateType: rate.rateType, amount: rate.amount, currency: rate.currency },
  };
}

// ─────────────────────────────────────────────
// Création
// ─────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.source — 'public_web' | 'owner_dashboard' | 'admin_dashboard'
 * @param {boolean} params.allowPast — réservé aux appels admin explicitement justifiés
 */
async function createReservation({
  hotelId, roomCategoryId, ratePlanId, guest, guestUserId,
  checkInDate, checkOutDate, roomsCount = 1, adults = 1, children = 0,
  specialRequests = '', source, actingUser = {}, allowPast = false,
}) {
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) { const err = new Error('Hôtel introuvable.'); err.statusCode = 404; throw err; }

  const category = await RoomCategory.findOne({ _id: roomCategoryId, hotel: hotelId });
  if (!category) { const err = new Error("Catégorie de chambres introuvable pour cet hôtel."); err.statusCode = 404; throw err; }
  if (category.status !== 'actif') { const err = new Error("Cette catégorie de chambres n'est plus disponible."); err.statusCode = 422; throw err; }

  assertNotPast(checkInDate, { allowPast });
  // Vérification "de confort" (message clair) avant la tentative atomique
  // réelle — la garantie anti-surbooking vient de reserveInventory (§5),
  // jamais de cette seule assertion.
  await assertAvailability({ roomCategoryId, checkInDate, checkOutDate, roomsCount });

  const nightDates = getNightDates(checkInDate, checkOutDate);
  const pricing = await computeReservationPricing({
    roomCategoryId, ratePlanId, nights: nightDates.length, roomsCount,
  });

  const reserveResult = await reserveInventory({
    hotelId, roomCategoryId, checkInDate, checkOutDate, roomsCount, actingUserId: actingUser?.id || null,
  });
  if (!reserveResult.ok) {
    const err = new Error('Certaines dates ne sont plus disponibles pour cette catégorie.');
    err.statusCode = 409;
    err.unavailableDates = reserveResult.unavailableDates;
    throw err;
  }

  let reservation;
  try {
    reservation = await HotelReservation.create({
      hotel: hotelId,
      roomCategory: roomCategoryId,
      ratePlan: ratePlanId,
      guestUser: guestUserId || null,
      guest,
      checkInDate, checkOutDate,
      roomsCount, adults, children,
      ...pricing,
      status: 'pending',
      source,
      specialRequests,
      pendingExpiresAt: new Date(Date.now() + PENDING_EXPIRY_HOURS * 3600 * 1000),
      createdBy: actingUser?.id || null,
      statusHistory: [{ from: null, to: 'pending', changedBy: actingUser?.id || null, reason: '' }],
    });
  } catch (error) {
    // Compensation — l'inventaire déjà réservé ne doit jamais rester
    // orphelin si l'écriture de la réservation échoue.
    await releaseInventory({ roomCategoryId, checkInDate, checkOutDate, roomsCount }).catch((releaseError) => {
      logger.error('Compensation inventaire échouée après échec de création HotelReservation', releaseError);
    });
    throw error;
  }

  notifyNewReservation(reservation, hotel).catch(() => {});
  return reservation;
}

async function notifyNewReservation(reservation, hotel) {
  if (!hotel.manager) return;
  await notify({
    recipient: hotel.manager,
    type: 'hotel_reservation_pending',
    title: '🛎️ Nouvelle demande de réservation',
    body: `Une demande (${reservation.reference}) attend votre confirmation pour "${hotel.name}".`,
    data: { reservationId: String(reservation._id), screen: 'MesReservations' },
  });
}

// ─────────────────────────────────────────────
// Transitions de statut — centralisées ici, jamais dans un contrôleur
// ─────────────────────────────────────────────

/** @throws si la transition n'est pas autorisée (mission §7). */
function assertTransitionAllowed(currentStatus, nextStatus) {
  const allowed = HotelReservation.ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    const err = new Error(`Transition invalide : ${currentStatus} → ${nextStatus}.`);
    err.statusCode = 409;
    throw err;
  }
}

const RELEASES_INVENTORY = new Set(['cancelled', 'rejected', 'expired']);

/**
 * Applique une transition de statut, journalise dans `statusHistory`,
 * libère l'inventaire si la nouvelle valeur le exige, notifie. Idempotence
 * (mission §10) : si la réservation est DÉJÀ dans `to`, renvoie la
 * réservation telle quelle sans re-libérer l'inventaire ni dupliquer
 * l'entrée d'historique — sauf si l'appelant préfère un rejet explicite (ici
 * choisi : idempotent, une double annulation ne doit jamais lever d'erreur).
 */
async function transitionStatus(reservation, { to, actingUser, reason = '' }) {
  if (reservation.status === to) {
    return reservation; // idempotent — ex: annulation déjà effective
  }
  assertTransitionAllowed(reservation.status, to);

  const from = reservation.status;
  if (RELEASES_INVENTORY.has(to)) {
    await releaseInventory({
      roomCategoryId: reservation.roomCategory,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      roomsCount: reservation.roomsCount,
    });
  }

  reservation.status = to;
  reservation.updatedBy = actingUser?.id || null;
  if (to === 'cancelled') { reservation.cancelledBy = actingUser?.id || null; reservation.cancellationReason = reason; }
  if (to === 'rejected') reservation.rejectionReason = reason;
  reservation.statusHistory.push({ from, to, changedBy: actingUser?.id || null, changedAt: new Date(), reason });
  await reservation.save();

  notifyStatusChange(reservation, to).catch(() => {});
  return reservation;
}

async function notifyStatusChange(reservation, status) {
  const recipient = reservation.guestUser;
  if (!recipient) return; // demande "invité" sans compte — rien à notifier côté client
  const copy = {
    confirmed: { type: 'hotel_reservation_confirmed', title: '✅ Réservation confirmée', body: `Votre réservation ${reservation.reference} est confirmée.` },
    rejected: { type: 'hotel_reservation_rejected', title: '❌ Réservation non confirmée', body: `Votre demande ${reservation.reference} n'a pas été confirmée.` },
    cancelled: { type: 'hotel_reservation_cancelled', title: '⛔ Réservation annulée', body: `Votre réservation ${reservation.reference} a été annulée.` },
    expired: { type: 'hotel_reservation_expired', title: '⌛ Demande expirée', body: `Votre demande ${reservation.reference} a expiré faute de confirmation.` },
  }[status];
  if (!copy) return;
  await notify({ recipient, ...copy, data: { reservationId: String(reservation._id), screen: 'MesReservations' } });
}

// ─────────────────────────────────────────────
// Modification (mission §9) — jamais de fenêtre de surbooking : la nouvelle
// période est réservée AVANT que l'ancienne soit libérée.
// ─────────────────────────────────────────────

async function updateReservation(reservation, changes, actingUser) {
  if (!['pending', 'confirmed'].includes(reservation.status)) {
    const err = new Error('Seule une réservation en attente ou confirmée peut être modifiée.');
    err.statusCode = 409;
    throw err;
  }

  const nextCheckIn = changes.checkInDate || reservation.checkInDate;
  const nextCheckOut = changes.checkOutDate || reservation.checkOutDate;
  const nextRoomsCount = changes.roomsCount ?? reservation.roomsCount;
  const nextCategoryId = changes.roomCategoryId || String(reservation.roomCategory);

  const datesOrCategoryChanged = String(nextCategoryId) !== String(reservation.roomCategory)
    || new Date(nextCheckIn).getTime() !== new Date(reservation.checkInDate).getTime()
    || new Date(nextCheckOut).getTime() !== new Date(reservation.checkOutDate).getTime()
    || nextRoomsCount !== reservation.roomsCount;

  if (datesOrCategoryChanged) {
    const reserveResult = await reserveInventory({
      hotelId: reservation.hotel,
      roomCategoryId: nextCategoryId,
      checkInDate: nextCheckIn,
      checkOutDate: nextCheckOut,
      roomsCount: nextRoomsCount,
      actingUserId: actingUser?.id || null,
    });
    if (!reserveResult.ok) {
      const err = new Error('Certaines dates ne sont plus disponibles pour cette modification.');
      err.statusCode = 409;
      err.unavailableDates = reserveResult.unavailableDates;
      throw err;
    }

    // La nouvelle période est sécurisée : on libère l'ancienne SEULEMENT
    // maintenant (jamais l'inverse, qui ouvrirait une fenêtre où une autre
    // réservation pourrait s'insérer sur les anciennes dates avant que
    // celle-ci ne les libère volontairement).
    await releaseInventory({
      roomCategoryId: reservation.roomCategory,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      roomsCount: reservation.roomsCount,
    });

    reservation.roomCategory = nextCategoryId;
    reservation.checkInDate = nextCheckIn;
    reservation.checkOutDate = nextCheckOut;
    reservation.roomsCount = nextRoomsCount;
  }

  if (changes.adults !== undefined) reservation.adults = changes.adults;
  if (changes.children !== undefined) reservation.children = changes.children;
  if (changes.specialRequests !== undefined) reservation.specialRequests = changes.specialRequests;

  // Prix systématiquement recalculé — jamais figé côté client (mission §6).
  const nightDates = getNightDates(reservation.checkInDate, reservation.checkOutDate);
  const pricing = await computeReservationPricing({
    roomCategoryId: reservation.roomCategory,
    ratePlanId: changes.ratePlanId || reservation.ratePlan,
    nights: nightDates.length,
    roomsCount: reservation.roomsCount,
  });
  Object.assign(reservation, pricing);
  if (changes.ratePlanId) reservation.ratePlan = changes.ratePlanId;

  reservation.updatedBy = actingUser?.id || null;
  await reservation.save();
  return reservation;
}

module.exports = {
  PENDING_EXPIRY_HOURS,
  computeReservationPricing,
  createReservation,
  assertTransitionAllowed,
  transitionStatus,
  updateReservation,
};
