// server/services/hotelReservationExpiryService.js — Sprint C §11
//
// Expiration simple des demandes 'pending' dont `pendingExpiresAt` est
// dépassé — même convention que visiteAutomationService.processVisitAutomation
// (déjà branché en cron toutes les 5 minutes dans server.js) : fonction pure
// et testable, prenant `now` en paramètre pour ne jamais dépendre de
// l'horloge système dans les tests. Ne libère JAMAIS une réservation
// confirmée automatiquement — seule une décision métier explicite annule
// une réservation confirmée (voir hotelReservationService.transitionStatus).

const mongoose = require('mongoose');
const HotelReservation = require('../models/HotelReservation');
const availabilityService = require('./hotelAvailabilityService');
const roomAssignmentService = require('./roomAssignmentService');
const { notifyReservationGuest } = require('./hotelReservationNotificationService');
const { emitHotelEvent } = require('../socket');
const { notifyStaff } = require('./notificationService');
const logger = require('../utils/logger');

async function expireReservationAtomically(reservationId, { now = new Date(), faultInjector } = {}) {
  const session = await mongoose.startSession();
  let expired = null;
  try {
    await session.withTransaction(async () => {
      expired = await HotelReservation.findOneAndUpdate(
        { _id: reservationId, status: 'pending', pendingExpiresAt: { $ne: null, $lte: now } },
        {
          $set: { status: 'expired' },
          $push: { statusHistory: { from: 'pending', to: 'expired', changedAt: now, reason: 'Expiration automatique (délai de confirmation dépassé).' } },
        },
        { new: true, session },
      );
      if (!expired) return;
      await availabilityService.releaseInventory({
        roomCategoryId: expired.roomCategory,
        checkInDate: expired.checkInDate,
        checkOutDate: expired.checkOutDate,
        roomsCount: expired.roomsCount,
        session,
      });
      if (roomAssignmentService.releaseAllRooms) {
        await roomAssignmentService.releaseAllRooms({
          reservationId: expired._id,
          actingUser: null,
          reason: 'Expiration automatique (délai de confirmation dépassé).',
          nextRoomStatus: 'available',
          session,
        });
      }
      if (faultInjector) await faultInjector('after_inventory_release');
    });
  } finally {
    await session.endSession();
  }
  if (!expired) return null;

  await Promise.allSettled([
    notifyReservationGuest({
      reservation: expired,
      eventKey: 'status:expired',
      type: 'hotel_reservation_expired',
      title: 'Demande de réservation expirée',
      body: `Votre demande ${expired.reference} a expiré faute de confirmation dans le délai imparti.`,
    }),
    emitHotelEvent(expired.hotel, { eventType: 'reservation.expired', entityType: 'HotelReservation', entityId: expired._id, status: 'expired' }),
  ]);
  return expired;
}

async function processReservationExpiry(now = new Date(), { expireOne = expireReservationAtomically } = {}) {
  const candidates = await HotelReservation.find({
    status: 'pending',
    pendingExpiresAt: { $ne: null, $lte: now },
  });

  let expiredCount = 0;
  for (const reservation of candidates) {
    try {
      const expired = await expireOne(reservation._id, { now });
      if (expired) expiredCount += 1;
    } catch (error) {
      logger.error(`Expiration HotelReservation ${reservation._id} échouée`, error);
    }
  }

  if (expiredCount > 0) {
    await notifyStaff({
      type: 'hotel_reservation_expired_batch',
      title: 'Demandes de réservation hôtelière expirées',
      body: `${expiredCount} demande(s) non confirmée(s) ont expiré.`,
      data: { screen: 'AdminHotelReservations' },
    }).catch(() => {});
  }

  return { expired: expiredCount };
}

module.exports = { processReservationExpiry, expireReservationAtomically };
