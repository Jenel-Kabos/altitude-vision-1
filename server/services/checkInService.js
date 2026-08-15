const HotelReservation = require('../models/HotelReservation');
const Room = require('../models/Room');
const roomAssignmentService = require('./roomAssignmentService');
const { notifyStaff } = require('./notificationService');
const { notifyReservationGuest } = require('./hotelReservationNotificationService');
const { runFinancialOperation } = require('./finance/financialTransactionService');
const FinancialDocument = require('../models/FinancialDocument');
const { createHotelInvoiceDraftFromReservation } = require('./finance/hotelBillingAdapter');
const logger = require('../utils/logger');
const { emitHotelEvent } = require('../socket');

function fail(code, message, statusCode = 409) { const error = new Error(message); error.code = code; error.statusCode = statusCode; throw error; }
const actorId = (actor) => actor?.id || actor?._id || null;

async function performCheckInCore({ reservationId, reservationSeed, roomId, roomIds, autoAssign, actingUser, reason, session }) {
  const query = HotelReservation.findOne({ _id: reservationId, status: 'confirmed' });
  const reservation = !session && reservationSeed ? reservationSeed : await (session ? query.session(session) : query);
  if (!reservation) fail('CHECKIN_CONCURRENT_MODIFICATION', 'Seule une réservation confirmée peut faire l’objet d’un check-in.');
  if (reservation.status !== 'confirmed') fail('CHECKIN_CONCURRENT_MODIFICATION', 'Seule une réservation confirmée peut faire l’objet d’un check-in.');
  const requiredRooms = Number(reservation.roomsCount) || 1;

  let assignments;
  if (roomAssignmentService.getActiveAssignments) assignments = await roomAssignmentService.getActiveAssignments(reservation._id, { session });
  if (!Array.isArray(assignments)) {
    const legacy = await roomAssignmentService.getActiveAssignment(reservation._id, { session });
    assignments = legacy ? [legacy] : [];
  }
  const requestedIds = [...new Set([...(Array.isArray(roomIds) ? roomIds : []), ...(roomId ? [roomId] : [])].map(String))];
  const assignedIds = new Set(assignments.map((item) => String(item.room?._id || item.room)));
  for (const requestedId of requestedIds.filter((id) => !assignedIds.has(id))) {
    if (assignments.length >= requiredRooms) break;
    // eslint-disable-next-line no-await-in-loop
    let created;
    if (session && roomAssignmentService.createAssignment) created = await roomAssignmentService.createAssignment({ reservationId: reservation._id, roomId: requestedId, reservation, actingUser, reason: 'Affectation au check-in', session });
    else created = await roomAssignmentService.assignRoom({ reservationId: reservation._id, roomId: requestedId, reservation, actingUser, reason: 'Affectation au check-in' });
    if (roomAssignmentService.getActiveAssignments) assignments = await roomAssignmentService.getActiveAssignments(reservation._id, { session });
    if (!Array.isArray(assignments)) {
      const persisted = await roomAssignmentService.getActiveAssignment(reservation._id, { session });
      const populated = !persisted && created?.populate ? await created.populate('room') : created;
      assignments = [persisted || populated].filter(Boolean);
    }
  }

  if (autoAssign && assignments.length < requiredRooms) {
    const candidates = await roomAssignmentService.getAvailableRooms({ hotelId: reservation.hotel, roomCategoryId: reservation.roomCategory, session });
    for (const room of candidates) {
      if (assignments.length >= requiredRooms) break;
      if (assignments.some((item) => String(item.room?._id || item.room) === String(room._id))) continue;
      // eslint-disable-next-line no-await-in-loop
      await roomAssignmentService.createAssignment({ reservationId: reservation._id, roomId: room._id, reservation, actingUser, reason: 'Affectation automatique au check-in', session });
      assignments = await roomAssignmentService.getActiveAssignments(reservation._id, { session });
    }
  }

  if (assignments.length !== requiredRooms) {
    fail('CHECKIN_ASSIGNMENT_INCOMPLETE', `Le check-in exige ${requiredRooms} chambre(s) affectée(s) ; ${assignments.length} seulement le sont.`, 422);
  }

  const rooms = assignments.map((item) => item.room);
  if (rooms.some((room) => !room || !['available', 'reserved'].includes(room.status))) {
    fail('ROOM_NOT_OPERATIONAL', 'Au moins une chambre affectée n’est plus disponible.');
  }
  const roomIdsToOccupy = rooms.map((room) => room._id);
  let resultRooms;
  if (!session && roomIdsToOccupy.length === 1) {
    const updated = await Room.findOneAndUpdate({ _id: roomIdsToOccupy[0], status: { $in: ['available', 'reserved'] } }, { $set: { status: 'occupied', updatedBy: actorId(actingUser) } }, { new: true });
    if (!updated) fail('CHECKIN_CONCURRENT_MODIFICATION', 'Une chambre vient de devenir indisponible.');
    resultRooms = [updated];
  } else {
    const update = await Room.updateMany(
      { _id: { $in: roomIdsToOccupy }, active: true, status: { $in: ['available', 'reserved'] } },
      { $set: { status: 'occupied', updatedBy: actorId(actingUser) } },
      { session },
    );
    if (update.modifiedCount !== roomIdsToOccupy.length) fail('CHECKIN_CONCURRENT_MODIFICATION', 'Une chambre vient de devenir indisponible.');
    resultRooms = rooms.map((room) => ({ ...(room.toObject ? room.toObject() : room), status: 'occupied' }));
  }

  reservation.status = 'checked_in';
  reservation.actualCheckInAt = new Date();
  reservation.updatedBy = actorId(actingUser);
  reservation.statusHistory.push({ from: 'confirmed', to: 'checked_in', changedBy: actorId(actingUser), changedAt: new Date(), reason });
  await reservation.save({ session });
  return { reservation, rooms: resultRooms };
}

async function performCheckIn({ reservation, reservationId, roomId, roomIds, autoAssign = false, actingUser, reason = '', transactionMode = 'fallback', notificationDependencies = {} }) {
  const id = reservationId || reservation?._id;
  const result = await runFinancialOperation(
    { operationName: 'hotel.check_in', transactionMode },
    ({ session }) => performCheckInCore({ reservationId: id, reservationSeed: reservation, roomId, roomIds, autoAssign, actingUser, reason, session }),
  );

  await notifyReservationGuest({ reservation: result.reservation, eventKey: 'checked_in', type: 'hotel_reservation_checked_in', title: '🔑 Check-in effectué', body: `Votre check-in pour ${result.reservation.reference} est enregistré.`, ...notificationDependencies }).catch(() => {});

  let financialDocument;
  try {
    const existing = await FinancialDocument.findOne({ domain: 'hotel', subjectType: 'HotelReservation', subjectId: id }).select('_id status');
    const document = await createHotelInvoiceDraftFromReservation({ reservationId: id, actor: actingUser, source: 'check_in' });
    financialDocument = { id: document._id, status: document.status, created: !existing, alreadyExisted: Boolean(existing) };
  } catch (error) {
    logger.error('hotel.check_in.financial_draft_failed', { reservationId: String(id), errorCode: error.code || 'FINANCIAL_DRAFT_CREATION_FAILED' });
    notifyStaff({ type: 'hotel_financial_draft_failed', title: 'Brouillon financier à reprendre', body: `Le check-in ${result.reservation.reference} est réussi, mais son brouillon financier doit être recréé.`, data: { reservationId: String(id), hotelId: String(result.reservation.hotel) } }).catch(() => {});
    financialDocument = { status: 'creation_failed', retryable: true, code: error.code || 'FINANCIAL_DRAFT_CREATION_FAILED' };
  }
  await emitHotelEvent(result.reservation.hotel, { eventType: 'reservation.checked_in', entityType: 'HotelReservation', entityId: result.reservation._id, status: result.reservation.status }).catch(() => {});
  return { reservation: result.reservation, rooms: result.rooms, room: result.rooms[0] || null, financialDocument };
}

module.exports = { performCheckIn, performCheckInCore };
