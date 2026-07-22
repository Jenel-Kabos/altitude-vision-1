// server/services/checkOutService.js — Sprint D
//
// checked_in → checked_out. Libère la chambre (jamais directement
// 'available' — toujours 'cleaning', mission §6) et clôture le
// RoomAssignment actif. Ne supprime jamais rien : l'historique
// (statusHistory, RoomAssignment.releasedAt) reste intégralement consultable.

const HotelReservation = require('../models/HotelReservation');
const { releaseRoom, getActiveAssignment } = require('./roomAssignmentService');
const { createTask } = require('./housekeepingService');
const { notify } = require('./notificationService');

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function performCheckOut({ reservation, actingUser, reason = '' }) {
  if (reservation.status !== 'checked_in') {
    throw fail('Seule une réservation en cours de séjour (checked_in) peut faire l\'objet d\'un check-out.', 409);
  }
  const allowed = HotelReservation.ALLOWED_TRANSITIONS[reservation.status] || [];
  if (!allowed.includes('checked_out')) throw fail('Transition invalide vers checked_out.', 409);

  const assignment = await getActiveAssignment(reservation._id);
  let room = null;
  if (assignment) {
    // Jamais 'available' directement — une chambre quittée passe par le
    // nettoyage avant de redevenir réservable (mission §6).
    const released = await releaseRoom({ reservationId: reservation._id, actingUser, reason, nextRoomStatus: 'cleaning' });
    room = released.room;

    // Sprint E §3 — génération automatique d'une tâche de ménage au
    // check-out. `createTask` refuse silencieusement (409 absorbé ici) si
    // une tâche ouverte existe déjà pour cette chambre — cas normal en cas
    // de double-appel/relance, jamais bloquant pour le check-out lui-même.
    await createTask({
      roomId: room._id, hotelId: reservation.hotel, reservationId: reservation._id,
      type: 'checkout_cleaning', priority: 'normal', actingUser,
    }).catch((err) => {
      if (err.statusCode !== 409) throw err;
    });
  }

  const from = reservation.status;
  reservation.status = 'checked_out';
  reservation.updatedBy = actingUser?.id || null;
  reservation.statusHistory.push({ from, to: 'checked_out', changedBy: actingUser?.id || null, changedAt: new Date(), reason });
  await reservation.save();

  if (reservation.guestUser) {
    await notify({
      recipient: reservation.guestUser,
      type: 'hotel_reservation_checked_out',
      title: '👋 Check-out effectué',
      body: `Votre séjour ${reservation.reference} est terminé. Merci de votre visite !`,
      data: { reservationId: String(reservation._id), screen: 'MesReservationsHotel' },
    }).catch(() => {});
  }

  return { reservation, room };
}

module.exports = { performCheckOut };
