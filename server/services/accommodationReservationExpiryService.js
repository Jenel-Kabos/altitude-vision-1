const Reservation = require('../models/AccommodationReservation');
const reservationService = require('./accommodationReservationService');
const { notify } = require('./notificationService');

async function processAccommodationReservationExpiry({ now = new Date(), limit = 200 } = {}) {
  const candidates = await Reservation.find({ status: 'pending_payment', paymentExpiresAt: { $lte: now } })
    .select('_id guest owner paymentExpiresAt amountPaid pricingSnapshot.requiredToConfirm')
    .sort({ paymentExpiresAt: 1 }).limit(limit).lean();
  let expired = 0;
  for (const candidate of candidates) {
    const reservation = await reservationService.expirePendingReservation({ reservationId: candidate._id, now });
    if (!reservation) continue;
    expired += 1;
    const claimed = await Reservation.findOneAndUpdate(
      { _id: reservation._id, expirationNotifiedAt: null },
      { $set: { expirationNotifiedAt: now } },
    );
    if (claimed) await notify({ recipient: reservation.guest, sender: reservation.owner, type: 'accommodation_reservation_expired', title: 'Demande expirée', message: 'Votre demande de réservation a expiré faute de paiement dans le délai de 2 heures.', link: '/profile', entityType: 'AccommodationReservation', entityId: reservation._id }).catch(() => null);
  }
  return { matched: candidates.length, expired };
}

module.exports = { processAccommodationReservationExpiry };
