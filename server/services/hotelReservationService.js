// server/services/hotelReservationService.js — Sprint C
//
// Cycle de vie complet d'une HotelReservation : tarification serveur
// (jamais confiance au total envoyé par le client), transitions de statut
// centralisées (jamais dans les contrôleurs), historisation, notifications.
// Toute opération qui touche l'inventaire délègue à hotelAvailabilityService
// — aucune logique de stock dupliquée ici.

const crypto = require('crypto');
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const HotelReservation = require('../models/HotelReservation');
const {
  assertNotPast, assertAvailability, reserveInventory, releaseInventory, getNightDates,
} = require('./hotelAvailabilityService');
const roomAssignmentService = require('./roomAssignmentService');
const { notify } = require('./notificationService');
const { notifyReservationGuest } = require('./hotelReservationNotificationService');
const { emitHotelEvent } = require('../socket');
const logger = require('../utils/logger');
const { isTransactionUnavailable } = require('./finance/financialTransactionService');

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
async function computeReservationPricing({ roomCategoryId, ratePlanId, nights, roomsCount, nightDates = null, session = null }) {
  const rateQuery = RatePlan.findOne({ _id: ratePlanId, roomCategory: roomCategoryId, active: true });
  const rate = await (session ? rateQuery.session(session) : rateQuery);
  if (!rate) {
    const err = new Error("Le tarif sélectionné n'est plus disponible pour cette catégorie.");
    err.statusCode = 422;
    throw err;
  }
  const dates = nightDates || Array.from({ length: nights }, () => null);
  const nightlyRates = dates.map((date) => {
    const applicable = date ? (rate.seasonalPeriods || [])
      .filter((period) => new Date(period.startDate) <= date && date < new Date(period.endDate))
      .sort((a, b) => b.priority - a.priority)[0] : null;
    return {
      date, amount: applicable?.amount ?? rate.amount,
      periodId: applicable?._id || null, periodLabel: applicable?.label || '',
      priority: applicable ? applicable.priority : null,
    };
  });
  const subtotal = nightlyRates.reduce((sum, nightly) => sum + nightly.amount, 0) * roomsCount;
  // `unitPrice` reste compatible avec les consommateurs historiques : il
  // représente le tarif de base. Le détail réellement facturé est figé
  // nuit par nuit dans le snapshot.
  const unitPrice = rate.amount;
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
    rateSnapshot: { rateType: rate.rateType, amount: rate.amount, currency: rate.currency, nightlyRates },
  };
}

function reservationFingerprint(payload) {
  const normalized = {
    hotel: String(payload.hotelId), roomCategory: String(payload.roomCategoryId), ratePlan: String(payload.ratePlanId || ''),
    checkInDate: new Date(payload.checkInDate).toISOString(), checkOutDate: new Date(payload.checkOutDate).toISOString(),
    roomsCount: Number(payload.roomsCount), adults: Number(payload.adults), children: Number(payload.children),
    guestUser: payload.guestUserId ? String(payload.guestUserId) : null,
    guest: {
      firstName: String(payload.guest?.firstName || '').trim(), lastName: String(payload.guest?.lastName || '').trim(),
      email: String(payload.guest?.email || '').trim().toLowerCase(), phone: String(payload.guest?.phone || '').trim(),
      country: String(payload.guest?.country || '').trim(),
    },
    specialRequests: String(payload.specialRequests || '').trim(),
    pricing: payload.pricing,
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function idempotencyConflict() {
  const error = new Error("Cette clé d’idempotence a déjà été utilisée avec une réservation différente.");
  error.code = 'RESERVATION_IDEMPOTENCY_CONFLICT'; error.statusCode = 409;
  return error;
}

async function findIdempotentReservation(hotelId, reservationRequestId, requestHash, session = null) {
  if (!reservationRequestId) return null;
  const query = HotelReservation.findOne({ hotel: hotelId, reservationRequestId }).select('+reservationRequestHash');
  const existing = await (session ? query.session(session) : query);
  if (!existing) return null;
  if (existing.reservationRequestHash !== requestHash) throw idempotencyConflict();
  existing.$locals = existing.$locals || {};
  existing.$locals.idempotent = true;
  return existing;
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
  specialRequests = '', source, actingUser = {}, allowPast = false, reservationRequestId = null,
  notificationDependencies = {},
}) {
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) { const err = new Error('Hôtel introuvable.'); err.statusCode = 404; throw err; }
  let attribution = hotel.tenant
    ? { status: 'resolved', tenantId: String(hotel.tenant) }
    : { status: 'unresolved', tenantId: null };
  if (!hotel.tenant && actingUser?.platformTenant) {
    const { resolveResourceTenant } = require('./platformTenant/tenantResourceAttributionService');
    attribution = await resolveResourceTenant({ resourceType: 'Hotel', resource: hotel });
  }
  if (actingUser?.platformTenant && (attribution.status !== 'resolved' || String(attribution.tenantId) !== String(actingUser.platformTenant._id || actingUser.platformTenant))) {
    const err = new Error('Hôtel introuvable dans ce contexte tenant.'); err.code = 'TENANT_RESOURCE_NOT_FOUND'; err.statusCode = 404; throw err;
  }

  const category = await RoomCategory.findOne({ _id: roomCategoryId, hotel: hotelId });
  if (!category) { const err = new Error("Catégorie de chambres introuvable pour cet hôtel."); err.statusCode = 404; throw err; }
  if (category.status !== 'actif') { const err = new Error("Cette catégorie de chambres n'est plus disponible."); err.statusCode = 422; throw err; }

  assertNotPast(checkInDate, { allowPast });
  const nightDates = getNightDates(checkInDate, checkOutDate);
  const pricing = await computeReservationPricing({
    roomCategoryId, ratePlanId, nights: nightDates.length, roomsCount, nightDates,
  });

  const normalizedRequestId = String(reservationRequestId || '').trim() || null;
  if (normalizedRequestId && normalizedRequestId.length > 128) {
    const error = new Error("La clé d’idempotence est invalide."); error.code = 'RESERVATION_IDEMPOTENCY_KEY_INVALID'; error.statusCode = 422; throw error;
  }
  const requestHash = normalizedRequestId ? reservationFingerprint({
    hotelId, roomCategoryId, ratePlanId, guest, guestUserId, checkInDate, checkOutDate,
    roomsCount, adults, children, specialRequests, pricing,
  }) : null;
  const alreadyCreated = await findIdempotentReservation(hotelId, normalizedRequestId, requestHash);
  if (alreadyCreated) return alreadyCreated;
  // Vérification de confort après la résolution d'idempotence : un retry
  // valide doit retrouver sa réservation même si celle-ci occupe désormais
  // le dernier stock.
  await assertAvailability({ roomCategoryId, checkInDate, checkOutDate, roomsCount });

  const createCore = async (session = null) => {
    const concurrentExisting = await findIdempotentReservation(hotelId, normalizedRequestId, requestHash, session);
    if (concurrentExisting) return concurrentExisting;

    const reserveResult = await reserveInventory({
      hotelId, roomCategoryId, checkInDate, checkOutDate, roomsCount, actingUserId: actingUser?.id || null, session,
    });
    if (!reserveResult.ok) {
      const err = new Error('Certaines dates ne sont plus disponibles pour cette catégorie.');
      err.code = 'RESERVATION_INVENTORY_UNAVAILABLE'; err.statusCode = 409; err.unavailableDates = reserveResult.unavailableDates;
      throw err;
    }

    const data = {
      tenant: attribution.status === 'resolved' ? attribution.tenantId : null,
      hotel: hotelId,
      reservationRequestId: normalizedRequestId,
      reservationRequestHash: requestHash,
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
    };
    try {
      const reservation = session ? (await HotelReservation.create([data], { session }))[0] : await HotelReservation.create(data);
      reservation.$locals = reservation.$locals || {};
      reservation.$locals.idempotent = false;
      return reservation;
    } catch (error) {
      if (error.code === 11000 && normalizedRequestId && !session) {
        await releaseInventory({ roomCategoryId, checkInDate, checkOutDate, roomsCount }).catch((releaseError) => {
          logger.error('Compensation inventaire échouée après conflit idempotent HotelReservation', releaseError);
        });
        const existing = await findIdempotentReservation(hotelId, normalizedRequestId, requestHash);
        if (existing) return existing;
      }
      if (error.code === 11000 && normalizedRequestId) throw error;
    // Compensation — l'inventaire déjà réservé ne doit jamais rester
    // orphelin si l'écriture de la réservation échoue.
      if (!session) await releaseInventory({ roomCategoryId, checkInDate, checkOutDate, roomsCount }).catch((releaseError) => {
      logger.error('Compensation inventaire échouée après échec de création HotelReservation', releaseError);
      });
      throw error;
    }
  };

  let reservation;
  if (normalizedRequestId) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => { reservation = await createCore(session); });
    } catch (error) {
      if (error.code === 11000) {
        reservation = await findIdempotentReservation(hotelId, normalizedRequestId, requestHash);
        if (!reservation) throw error;
      } else if (isTransactionUnavailable(error)) {
        logger.warn('hotel.reservation.transaction_unavailable', { hotelId, reservationRequestId: normalizedRequestId });
        reservation = await createCore(null);
      } else throw error;
    } finally { await session.endSession(); }
  } else reservation = await createCore(null);

  if (!reservation.$locals?.idempotent) {
    // Effets post-commit attendus : la réponse ne part pas alors qu'une
    // notification persistée est encore en course avec un retry/cleanup.
    await Promise.allSettled([
      notifyNewReservation(reservation, hotel),
      notifyReservationGuest({ reservation, eventKey: 'created', type: 'hotel_reservation_created', title: 'Demande de réservation reçue', body: `Votre demande ${reservation.reference} a bien été enregistrée.`, ...notificationDependencies }),
    ]);
  }
  return reservation;
}

async function notifyNewReservation(reservation, hotel) {
  if (!hotel.manager) return;
  await notify({
    recipient: hotel.manager,
    type: 'hotel_reservation_pending',
    title: '🛎️ Nouvelle demande de réservation',
    body: `Une demande (${reservation.reference}) attend votre confirmation pour "${hotel.name}".`,
    entityType: 'HotelReservation',
    entityId: reservation._id,
    data: { reservationId: String(reservation._id), hotelId: String(hotel._id), screen: 'MesReservations' },
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
    // Correctif — anomalie réelle détectée à l'audit : une chambre affectée
    // en amont (Sprint D) restait "reserved" indéfiniment si la réservation
    // était annulée/rejetée/expirée AVANT le check-in — orpheline, jamais
    // reproposée. Ces trois transitions ne sont atteignables que depuis un
    // statut pré-check-in (voir ALLOWED_TRANSITIONS : `checked_in` ne peut
    // transiter que vers `checked_out`), donc toute affectation active à ce
    // stade n'a jamais été occupée — libération directe vers 'available'.
    // `releaseRoom` lève une 404 s'il n'existe aucune affectation active —
    // cas normal (aucune chambre n'avait encore été affectée), ignoré ici.
    if (roomAssignmentService.releaseAllRooms) {
      await roomAssignmentService.releaseAllRooms({
        reservationId: reservation._id, actingUser, reason: `Réservation ${to}`, nextRoomStatus: 'available',
      });
    } else {
      // Compatibilité des adaptateurs et doubles de tests antérieurs C/D.
      await roomAssignmentService.releaseRoom({
        reservationId: reservation._id, actingUser, reason: `Réservation ${to}`, nextRoomStatus: 'available',
      }).catch((err) => { if (err.statusCode !== 404) throw err; });
    }
  }

  reservation.status = to;
  reservation.updatedBy = actingUser?.id || null;
  if (to === 'cancelled') { reservation.cancelledBy = actingUser?.id || null; reservation.cancellationReason = reason; }
  if (to === 'rejected') reservation.rejectionReason = reason;
  reservation.statusHistory.push({ from, to, changedBy: actingUser?.id || null, changedAt: new Date(), reason });
  await reservation.save();

  notifyStatusChange(reservation, to).catch(() => {});
  await emitHotelEvent(reservation.hotel, { eventType: `reservation.${to}`, entityType: 'HotelReservation', entityId: reservation._id, status: to }).catch(() => {});
  return reservation;
}

async function notifyStatusChange(reservation, status) {
  const copy = {
    confirmed: { type: 'hotel_reservation_confirmed', title: '✅ Réservation confirmée', body: `Votre réservation ${reservation.reference} est confirmée.` },
    rejected: { type: 'hotel_reservation_rejected', title: '❌ Réservation non confirmée', body: `Votre demande ${reservation.reference} n'a pas été confirmée.` },
    cancelled: { type: 'hotel_reservation_cancelled', title: '⛔ Réservation annulée', body: `Votre réservation ${reservation.reference} a été annulée.` },
    expired: { type: 'hotel_reservation_expired', title: '⌛ Demande expirée', body: `Votre demande ${reservation.reference} a expiré faute de confirmation.` },
  }[status];
  if (!copy) return;
  await notifyReservationGuest({ reservation, eventKey: `status:${status}`, ...copy });
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
    nightDates,
  });
  Object.assign(reservation, pricing);
  if (changes.ratePlanId) reservation.ratePlan = changes.ratePlanId;

  reservation.updatedBy = actingUser?.id || null;
  await reservation.save();
  notifyReservationGuest({ reservation, eventKey: `modified:${reservation.updatedAt?.toISOString?.() || Date.now()}`, type: 'hotel_reservation_modified', title: 'Réservation modifiée', body: `Votre réservation ${reservation.reference} a été modifiée.` }).catch(() => {});
  await emitHotelEvent(reservation.hotel, { eventType: 'reservation.modified', entityType: 'HotelReservation', entityId: reservation._id, status: reservation.status }).catch(() => {});
  return reservation;
}

module.exports = {
  PENDING_EXPIRY_HOURS,
  computeReservationPricing,
  reservationFingerprint,
  createReservation,
  assertTransitionAllowed,
  transitionStatus,
  updateReservation,
};
