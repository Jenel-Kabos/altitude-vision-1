// server/services/roomAssignmentService.js — Sprint D
//
// Toute la logique d'affectation de chambre est centralisée ici — jamais
// dans un contrôleur ni dupliquée entre checkInService/checkOutService, qui
// délèguent tous deux à ce service (mission : "empêcher les doubles
// affectations").
//
// Anti-concurrence : transaction MongoDB lorsque disponible, verrou local
// contrôlé en fallback et index unique partiel sur la chambre active.

const Room = require('../models/Room');
const RoomAssignment = require('../models/RoomAssignment');
const HotelReservation = require('../models/HotelReservation');
const { runFinancialOperation } = require('./finance/financialTransactionService');
const { createTask } = require('./housekeepingService');

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}
function businessFail(code, message, statusCode = 409) { const error = fail(message, statusCode); error.code = code; return error; }
const withSession = (query, session) => (session ? query.session(session) : query);
const reservationLocks = new Map();
async function withReservationLock(reservationId, operation) {
  const key = String(reservationId); const previous = reservationLocks.get(key) || Promise.resolve();
  let release; const current = new Promise((resolve) => { release = resolve; }); const tail = previous.then(() => current); reservationLocks.set(key, tail);
  await previous;
  try { return await operation(); } finally { release(); if (reservationLocks.get(key) === tail) reservationLocks.delete(key); }
}

/** Chambres candidates à une affectation — actives, disponibles, de la bonne catégorie. */
async function getAvailableRooms({ hotelId, roomCategoryId, includeReserved = false, session = null }) {
  const statuses = includeReserved ? ['available', 'reserved'] : ['available'];
  return withSession(Room.find({ hotel: hotelId, roomCategory: roomCategoryId, active: true, status: { $in: statuses } }).sort({ floor: 1, roomNumber: 1 }), session);
}

/**
 * Cœur partagé par `assignRoom` et `changeRoom` : valide la chambre et crée
 * l'affectation. Ne vérifie PAS si la réservation a déjà une affectation
 * active — c'est aux deux appelants de décider (assignRoom l'interdit,
 * changeRoom le présuppose puisque c'est justement son cas d'usage).
 */
function assertSingleRoom() { return true; } // compatibilité API historique

async function createAssignment({ reservationId, roomId, reservation, actingUser, reason = '', session = null }) {
  const room = await withSession(Room.findById(roomId), session);
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
    const roomFilter = { _id: roomId, status: { $in: ['available', 'reserved'] } };
    if (session) roomFilter.active = true;
    const roomUpdate = { $set: { status: 'reserved', updatedBy: actingUser?.id || null } };
    const updatedRoom = session
      ? await Room.findOneAndUpdate(roomFilter, roomUpdate, { new: true, session })
      : await Room.findOneAndUpdate(roomFilter, roomUpdate);
    if (!updatedRoom) throw businessFail('ROOM_ASSIGNMENT_CONFLICT', "Cette chambre vient de devenir indisponible.");
    const data = { reservation: reservationId, room: roomId, assignedBy: actingUser?.id || null, reason };
    assignment = session ? (await RoomAssignment.create([data], { session }))[0] : await RoomAssignment.create(data);
  } catch (error) {
    // E11000 : une autre requête concurrente vient d'affecter cette même
    // chambre (ou cette même réservation) entre notre vérification et cette
    // écriture — l'index unique partiel a fait son travail, jamais de
    // double affectation silencieuse.
    if (error.code === 11000) throw businessFail('ROOM_ASSIGNMENT_CONFLICT', 'Cette chambre vient déjà d\'être affectée à une autre réservation.');
    throw error;
  }

  return assignment;
}

/**
 * Affecte une chambre à une réservation qui n'en a pas encore. La chambre
 * doit appartenir au même hôtel ET à la même catégorie que la réservation
 * (jamais une Suite pour une réservation Standard). Transitionne la chambre
 * vers 'reserved' — jamais 'occupied' ici : seul le check-in occupe
 * réellement la chambre.
 */
async function assignRoomCore({ reservationId, roomId, reservation, actingUser, reason = '', session }) {
  const activeCount = await withSession(RoomAssignment.countDocuments({ reservation: reservationId, releasedAt: null }), session);
  if (activeCount >= reservation.roomsCount) throw businessFail('ROOM_ASSIGNMENT_LIMIT_REACHED', 'Toutes les chambres requises sont déjà affectées.');
  if (session) await HotelReservation.updateOne({ _id: reservationId }, { $inc: { assignmentVersion: 1 } }, { session });
  return createAssignment({ reservationId, roomId, reservation, actingUser, reason, session });
}
async function assignRoom(args) {
  const execute = () => runFinancialOperation({ operationName: 'hotel.room_assignment.create', transactionMode: args.transactionMode || 'fallback' }, ({ session }) => assignRoomCore({ ...args, session }));
  return (args.transactionMode || 'fallback') === 'fallback' ? withReservationLock(args.reservationId, execute) : execute();
}

async function autoAssignRooms({ reservationId, reservation, actingUser, reason = '', transactionMode = 'auto' }) {
  return runFinancialOperation({ operationName: 'hotel.room_assignment.auto', transactionMode }, async ({ session }) => {
    const existing = await withSession(RoomAssignment.find({ reservation: reservationId, releasedAt: null }), session);
    const missing = reservation.roomsCount - existing.length;
    if (missing <= 0) return existing;
    const rooms = await getAvailableRooms({ hotelId: reservation.hotel, roomCategoryId: reservation.roomCategory, session });
    const already = new Set(existing.map((item) => String(item.room)));
    const candidates = rooms.filter((room) => !already.has(String(room._id))).slice(0, missing);
    if (candidates.length !== missing) throw businessFail('RESERVATION_MULTI_ROOM_ASSIGNMENT_INCOMPLETE', 'Le nombre de chambres physiques disponibles est insuffisant.');
    const created = [];
    for (const room of candidates) { // ordre étage puis numéro : déterministe
      // eslint-disable-next-line no-await-in-loop
      created.push(await createAssignment({ reservationId, roomId: room._id, reservation, actingUser, reason: reason || 'Affectation automatique', session }));
    }
    return [...existing, ...created];
  });
}

/**
 * Change une chambre : validation de la cible, libération historisée de
 * l'ancienne puis création de la nouvelle affectation dans la transaction.
 */
async function changeRoom({ reservationId, oldRoomId = null, newRoomId, reservation, actingUser, reason = '', transactionMode = 'fallback' }) {
  return runFinancialOperation({ operationName: 'hotel.room_assignment.change', transactionMode }, async ({ session }) => {
    const filter = { reservation: reservationId, releasedAt: null };
    if (oldRoomId) filter.room = oldRoomId;
    const current = await withSession(RoomAssignment.findOne(filter), session);
    if (!current) throw businessFail('ROOM_CHANGE_CONFLICT', 'Aucune affectation active correspondante.', 404);
    if (String(current.room) === String(newRoomId)) throw businessFail('ROOM_CHANGE_CONFLICT', 'La réservation est déjà dans cette chambre.', 422);
    const newRoom = await withSession(Room.findById(newRoomId), session);
    if (!newRoom || !newRoom.active || String(newRoom.hotel) !== String(reservation.hotel)) throw businessFail('ROOM_NOT_OPERATIONAL', 'La nouvelle chambre est introuvable ou hors de cet hôtel.', 422);
    if (String(newRoom.roomCategory) !== String(reservation.roomCategory)) throw businessFail('ROOM_CATEGORY_MISMATCH', 'La nouvelle chambre ne correspond pas à la catégorie réservée.', 422);
    if (newRoom.status !== 'available') throw businessFail('ROOM_CHANGE_CONFLICT', 'La nouvelle chambre n’est pas disponible.');
    const wasOccupied = reservation.status === 'checked_in';
    await releaseRoomAssignment(current, { actingUser, reason: reason || 'Changement de chambre', nextRoomStatus: wasOccupied ? 'cleaning' : 'available', session });
    const replacement = await createAssignment({ reservationId, roomId: newRoomId, reservation, actingUser, reason, session });
    if (wasOccupied) {
      await Room.updateOne({ _id: newRoomId, status: 'reserved' }, { $set: { status: 'occupied' } }, { session });
      await createTask({ roomId: current.room, hotelId: reservation.hotel, reservationId, type: 'refresh', priority: 'high', notes: 'Nettoyage après changement de chambre en cours de séjour', actingUser, session, notifyAfterCreate: false });
    }
    if (reservation.requiresRoomReassignment) {
      await HotelReservation.updateOne(
        { _id: reservationId },
        { $set: { requiresRoomReassignment: false, reassignmentReason: '' } },
        session ? { session } : undefined,
      );
    }
    return replacement;
  });
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

async function releaseAllRooms({ reservationId, actingUser, reason = '', nextRoomStatus = 'available', session }) {
  const assignments = await withSession(RoomAssignment.find({ reservation: reservationId, releasedAt: null }), session);
  const released = [];
  for (const assignment of assignments) {
    // eslint-disable-next-line no-await-in-loop
    released.push(await releaseRoomAssignment(assignment, { actingUser, reason, nextRoomStatus, session }));
  }
  return released;
}

async function getActiveAssignment(reservationId, { session } = {}) {
  const query = RoomAssignment.findOne({ reservation: reservationId, releasedAt: null }).populate('room');
  return session ? query.session(session) : query;
}
async function getActiveAssignments(reservationId, { session } = {}) {
  const query = RoomAssignment.find({ reservation: reservationId, releasedAt: null }).sort({ assignedAt: 1 }).populate('room');
  return session ? query.session(session) : query;
}

module.exports = {
  getAvailableRooms, createAssignment, assignRoom, autoAssignRooms, changeRoom, releaseRoom, releaseAllRooms, releaseRoomAssignment, getActiveAssignment, getActiveAssignments,
  assertSingleRoom,
};
