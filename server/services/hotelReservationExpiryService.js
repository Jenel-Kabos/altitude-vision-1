// server/services/hotelReservationExpiryService.js — Sprint C §11
//
// Expiration simple des demandes 'pending' dont `pendingExpiresAt` est
// dépassé — même convention que visiteAutomationService.processVisitAutomation
// (déjà branché en cron toutes les 5 minutes dans server.js) : fonction pure
// et testable, prenant `now` en paramètre pour ne jamais dépendre de
// l'horloge système dans les tests. Ne libère JAMAIS une réservation
// confirmée automatiquement — seule une décision métier explicite annule
// une réservation confirmée (voir hotelReservationService.transitionStatus).

const HotelReservation = require('../models/HotelReservation');
const { transitionStatus } = require('./hotelReservationService');
const { notifyStaff } = require('./notificationService');
const logger = require('../utils/logger');

async function processReservationExpiry(now = new Date()) {
  const candidates = await HotelReservation.find({
    status: 'pending',
    pendingExpiresAt: { $ne: null, $lte: now },
  });

  let expiredCount = 0;
  for (const reservation of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await transitionStatus(reservation, { to: 'expired', actingUser: null, reason: 'Expiration automatique (délai de confirmation dépassé).' });
      expiredCount += 1;
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

module.exports = { processReservationExpiry };
