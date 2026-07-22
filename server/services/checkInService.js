// server/services/checkInService.js — Sprint D
//
// confirmed → checked_in. Centralise TOUTE la logique de check-in : la
// validation de transition réutilise HotelReservation.ALLOWED_TRANSITIONS
// (même source de vérité que hotelReservationService.transitionStatus,
// Sprint C) — jamais une règle dupliquée.

const HotelReservation = require('../models/HotelReservation');
const Room = require('../models/Room');
const { assignRoom, getActiveAssignment, assertSingleRoom } = require('./roomAssignmentService');
const { notify } = require('./notificationService');

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * @param {object} params
 * @param {string} [params.roomId] — requis seulement si la réservation n'a
 *   pas déjà de chambre pré-affectée (voir Room Assignment, Sprint D §3-4).
 */
async function performCheckIn({ reservation, roomId, actingUser, reason = '' }) {
  if (reservation.status !== 'confirmed') {
    throw fail('Seule une réservation confirmée peut faire l\'objet d\'un check-in.', 409);
  }
  const allowed = HotelReservation.ALLOWED_TRANSITIONS[reservation.status] || [];
  if (!allowed.includes('checked_in')) throw fail('Transition invalide vers checked_in.', 409);
  // Correctif — garde-fou multi-chambres (mission §3) : même contrôle que
  // assignRoom/changeRoom, appliqué même quand une affectation existe déjà
  // (donnée historique ou incohérente) — jamais de check-in incohérent pour
  // une réservation multi-chambres tant que ce cas n'est pas développé.
  assertSingleRoom(reservation);

  let assignment = await getActiveAssignment(reservation._id);
  if (!assignment) {
    if (!roomId) throw fail('Une chambre doit être affectée avant le check-in.', 422);
    assignment = await assignRoom({ reservationId: reservation._id, roomId, reservation, actingUser, reason: 'Affectation au check-in' });
    assignment = await assignment.populate('room');
  }

  const room = assignment.room?.status ? assignment.room : await Room.findById(assignment.room);
  if (!['available', 'reserved'].includes(room.status)) {
    throw fail("La chambre affectée n'est plus disponible pour le check-in.", 409);
  }

  const updatedRoom = await Room.findOneAndUpdate(
    { _id: room._id, status: { $in: ['available', 'reserved'] } },
    { $set: { status: 'occupied', updatedBy: actingUser?.id || null } },
    { new: true },
  );
  if (!updatedRoom) throw fail("La chambre vient d'être occupée par une autre opération.", 409);

  const from = reservation.status;
  reservation.status = 'checked_in';
  reservation.updatedBy = actingUser?.id || null;
  reservation.statusHistory.push({ from, to: 'checked_in', changedBy: actingUser?.id || null, changedAt: new Date(), reason });
  await reservation.save();

  if (reservation.guestUser) {
    await notify({
      recipient: reservation.guestUser,
      type: 'hotel_reservation_checked_in',
      title: '🔑 Check-in effectué',
      body: `Votre check-in pour ${reservation.reference} est enregistré. Chambre ${updatedRoom.roomNumber}.`,
      data: { reservationId: String(reservation._id), screen: 'MesReservationsHotel' },
    }).catch(() => {});
  }

  return { reservation, room: updatedRoom };
}

module.exports = { performCheckIn };
