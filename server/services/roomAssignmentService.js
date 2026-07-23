// server/services/roomAssignmentService.js — Sprint D
//
// Toute la logique d'affectation de chambre est centralisée ici — jamais
// dans un contrôleur ni dupliquée entre checkInService/checkOutService, qui
// délèguent tous deux à ce service (mission : "empêcher les doubles
// affectations").
//
// Anti-concurrence : même stratégie que hotelAvailabilityService.js
// (Sprint C) — pas de transaction MongoDB (aucun précédent, voir audit),
// mais une création atomique protégée par l'index unique partiel
// {room, releasedAt:null} ET {reservation, releasedAt:null} (voir
// RoomAssignment.js). Une tentative de double affectation concurrente lève
// une erreur de clé dupliquée (E11000), interceptée ici et convertie en 409
// métier propre — jamais une stack trace exposée à l'appelant.

const Room = require('../models/Room');
const RoomAssignment = require('../models/RoomAssignment');

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** Chambres candidates à une affectation — actives, disponibles, de la bonne catégorie. */
async function getAvailableRooms({ hotelId, roomCategoryId, includeReserved = false }) {
  const statuses = includeReserved ? ['available', 'reserved'] : ['available'];
  return Room.find({ hotel: hotelId, roomCategory: roomCategoryId, active: true, status: { $in: statuses } }).sort({ roomNumber: 1 });
}

/**
 * Cœur partagé par `assignRoom` et `changeRoom` : valide la chambre et crée
 * l'affectation. Ne vérifie PAS si la réservation a déjà une affectation
 * active — c'est aux deux appelants de décider (assignRoom l'interdit,
 * changeRoom le présuppose puisque c'est justement son cas d'usage).
 */
// Correctif — garde-fou multi-chambres (mission §3 du correctif) : le
// Sprint D ne gère qu'UN SEUL RoomAssignment par réservation. Tant que
// l'affectation multi-chambres n'est pas développée, toute réservation dont
// `roomsCount !== 1` doit être exclue de l'affectation/changement/check-in
// — jamais forcée à 1, jamais plusieurs RoomAssignment créés en silence.
function assertSingleRoom(reservation) {
  if (reservation.roomsCount !== 1) {
    throw fail(
      'Cette réservation comporte plusieurs chambres et nécessite une affectation multiple, non encore prise en charge.',
      409,
    );
  }
}

async function createAssignment({ reservationId, roomId, reservation, actingUser, reason = '' }) {
  assertSingleRoom(reservation);
  const room = await Room.findById(roomId);
  if (!room) throw fail('Chambre introuvable.', 404);
  if (!room.active) throw fail("Cette chambre n'est plus active.", 422);
  if (String(room.hotel) !== String(reservation.hotel)) throw fail("Cette chambre n'appartient pas à cet hôtel.", 422);
  if (String(room.roomCategory) !== String(reservation.roomCategory)) {
    throw fail("Cette chambre n'appartient pas à la catégorie réservée.", 422);
  }
  if (!['available', 'reserved'].includes(room.status)) {
    throw fail("Cette chambre n'est pas disponible pour une affectation.", 409);
  }

  let assignment;
  try {
    assignment = await RoomAssignment.create({
      reservation: reservationId, room: roomId, assignedBy: actingUser?.id || null, reason,
    });
  } catch (error) {
    // E11000 : une autre requête concurrente vient d'affecter cette même
    // chambre (ou cette même réservation) entre notre vérification et cette
    // écriture — l'index unique partiel a fait son travail, jamais de
    // double affectation silencieuse.
    if (error.code === 11000) throw fail('Cette chambre vient déjà d\'être affectée à une autre réservation.', 409);
    throw error;
  }

  await Room.findOneAndUpdate({ _id: roomId, status: { $in: ['available', 'reserved'] } }, { $set: { status: 'reserved', updatedBy: actingUser?.id || null } });
  return assignment;
}

/**
 * Affecte une chambre à une réservation qui n'en a pas encore. La chambre
 * doit appartenir au même hôtel ET à la même catégorie que la réservation
 * (jamais une Suite pour une réservation Standard). Transitionne la chambre
 * vers 'reserved' — jamais 'occupied' ici : seul le check-in occupe
 * réellement la chambre.
 */
async function assignRoom({ reservationId, roomId, reservation, actingUser, reason = '' }) {
  const existingForReservation = await RoomAssignment.findOne({ reservation: reservationId, releasedAt: null });
  if (existingForReservation) {
    throw fail('Cette réservation a déjà une chambre affectée — utilisez le changement de chambre.', 409);
  }
  return createAssignment({ reservationId, roomId, reservation, actingUser, reason });
}

/**
 * Change la chambre d'une réservation : la NOUVELLE chambre est affectée
 * AVANT que l'ancienne soit libérée (même principe que
 * hotelReservationService.updateReservation, Sprint C — jamais de fenêtre
 * où la réservation n'a temporairement aucune chambre couverte pendant
 * qu'une autre requête pourrait s'insérer).
 */
async function changeRoom({ reservationId, newRoomId, reservation, actingUser, reason = '' }) {
  const current = await RoomAssignment.findOne({ reservation: reservationId, releasedAt: null });
  if (!current) throw fail('Aucune chambre actuellement affectée à cette réservation.', 404);
  if (String(current.room) === String(newRoomId)) throw fail('La réservation est déjà dans cette chambre.', 422);

  const wasOccupied = reservation.status === 'checked_in';
  const newAssignment = await createAssignment({ reservationId, roomId: newRoomId, reservation, actingUser, reason });

  // Si le client était déjà présent (checked_in), la nouvelle chambre passe
  // directement en 'occupied' (le client y est physiquement transféré) — la
  // règle "jamais occupied sans check-in" ne s'applique qu'à la PREMIÈRE
  // occupation d'une réservation, pas à un changement de chambre en cours de
  // séjour.
  if (wasOccupied) {
    await Room.findOneAndUpdate({ _id: newRoomId, status: 'reserved' }, { $set: { status: 'occupied' } });
  }

  await releaseRoomAssignment(current, { actingUser, reason: reason || 'Changement de chambre', nextRoomStatus: wasOccupied ? 'cleaning' : 'available' });
  return newAssignment;
}

/** Libère une affectation déjà chargée — usage interne (changeRoom/checkOutService). */
async function releaseRoomAssignment(assignment, { actingUser, reason = '', nextRoomStatus = 'available', session } = {}) {
  assignment.releasedAt = new Date();
  if (reason) assignment.reason = reason;
  await assignment.save({ session });
  const room = await Room.findByIdAndUpdate(
    assignment.room,
    { $set: { status: nextRoomStatus, updatedBy: actingUser?.id || null } },
    { new: true, session },
  );
  return { assignment, room };
}

/**
 * Libère la chambre active d'une réservation par son id (API publique du
 * service) — renvoie `{ assignment, room }` (room = document Room mis à jour).
 */
async function releaseRoom({ reservationId, actingUser, reason = '', nextRoomStatus = 'available', session }) {
  const query = RoomAssignment.findOne({ reservation: reservationId, releasedAt: null });
  const assignment = await (session ? query.session(session) : query);
  if (!assignment) throw fail('Aucune chambre active à libérer pour cette réservation.', 404);
  return releaseRoomAssignment(assignment, { actingUser, reason, nextRoomStatus, session });
}

async function getActiveAssignment(reservationId, { session } = {}) {
  const query = RoomAssignment.findOne({ reservation: reservationId, releasedAt: null }).populate('room');
  return session ? query.session(session) : query;
}

module.exports = {
  getAvailableRooms, assignRoom, changeRoom, releaseRoom, releaseRoomAssignment, getActiveAssignment,
  assertSingleRoom,
};
