const HotelReservation = require('../models/HotelReservation');
const roomAssignmentService = require('./roomAssignmentService');
const { normalizeDate, releaseInventory } = require('./hotelAvailabilityService');
const { createTask } = require('./housekeepingService');
const { notifyStaff } = require('./notificationService');
const { notifyReservationGuest } = require('./hotelReservationNotificationService');
const { runFinancialOperation } = require('./finance/financialTransactionService');
const { evaluateHotelCheckoutFinancialReadiness } = require('./finance/hotelCheckoutFinancialReadinessService');
const authz = require('./finance/financialAuthorizationService');
const { appendFinancialLedgerEntry } = require('./finance/financialLedgerService');
const logger = require('../utils/logger');
const { emitHotelEvent } = require('../socket');

function fail(code, message, statusCode, extra = {}) { const error = new Error(message); error.code = code; error.statusCode = statusCode; Object.assign(error, extra); throw error; }
const actorId = (actor) => actor?.id || actor?._id;
function validateOverride(value) {
  if (!value?.requested) return null;
  const reason = String(value.reason || '').trim();
  if (reason.length < 10 || reason.length > 1000) fail('FINANCIAL_OVERRIDE_REASON_REQUIRED', 'La justification de dérogation doit contenir entre 10 et 1000 caractères.', 422);
  const ticket = String(value.ticket || '').trim();
  if (ticket.length > 100) fail('FINANCIAL_OVERRIDE_TICKET_INVALID', 'La référence administrative est trop longue.', 422);
  return { reason, ticket: ticket || null };
}

async function performCheckOutCore({ reservationId, reservationSeed, actingUser, reason, financialOverride, session }) {
  logger.info('hotel_checkout.financial_evaluation_started', { reservationId, actorId: actorId(actingUser) });
  const query = HotelReservation.findOne({ _id: reservationId, status: 'checked_in' });
  const reservation = !session && reservationSeed ? reservationSeed : await (session ? query.session(session) : query);
  if (!reservation) fail('HOTEL_CHECKOUT_INVALID_STATE', 'Seule une réservation en cours de séjour (checked_in) peut faire l’objet d’un check-out.', 409);
  if (reservation.status !== 'checked_in') fail('HOTEL_CHECKOUT_INVALID_STATE', 'Seule une réservation en cours de séjour (checked_in) peut faire l’objet d’un check-out.', 409);
  const readiness = await evaluateHotelCheckoutFinancialReadiness({ reservationId: reservation._id, actor: actingUser, requestedHotelId: reservation.hotel, session, skipAuthorization: true });
  const requestedOverride = validateOverride(financialOverride);
  let overrideApplied = false;
  let overrideAuditId = null;
  if (!readiness.allowed) {
    logger.warn('hotel_checkout.financial_blocked', { reservationId, hotelId: reservation.hotel, actorId: actorId(actingUser), blockerCodes: readiness.blockers.map(({ code }) => code) });
    if (!requestedOverride) fail('CHECKOUT_BLOCKED_FINANCIAL', 'Le check-out est bloqué par la situation financière.', 409, { financialReadiness: readiness });
    if (actingUser?.role !== 'Admin') fail('FINANCIAL_OVERRIDE_FORBIDDEN', 'Seul un administrateur peut appliquer une dérogation financière.', 403, { financialReadiness: readiness });
    await authz.authorizeFinancialAction({ user: actingUser, capability: authz.CAPABILITIES.HOTEL_CHECKOUT_OVERRIDE, establishmentId: reservation.hotel });
    logger.info('hotel_checkout.financial_override_requested', { reservationId, hotelId: reservation.hotel, actorId: actorId(actingUser) });
  }
  let assignments;
  if (roomAssignmentService.getActiveAssignments) assignments = await roomAssignmentService.getActiveAssignments(reservation._id, { session });
  if (!Array.isArray(assignments)) {
    const legacy = await roomAssignmentService.getActiveAssignment(reservation._id, { session });
    assignments = legacy ? [legacy] : [];
  }
  let released = [];
  if (assignments.length && roomAssignmentService.releaseAllRooms) released = await roomAssignmentService.releaseAllRooms({ reservationId: reservation._id, actingUser, reason, nextRoomStatus: 'cleaning', session });
  if (assignments.length && !Array.isArray(released)) released = [await roomAssignmentService.releaseRoom({ reservationId: reservation._id, actingUser, reason, nextRoomStatus: 'cleaning', session })];
  const rooms = released.map((item) => item.room);
  for (const room of rooms) {
    try { // eslint-disable-next-line no-await-in-loop
      await createTask({ roomId: room._id, hotelId: reservation.hotel, reservationId: reservation._id, type: 'checkout_cleaning', priority: 'normal', actingUser, session, notifyAfterCreate: false });
    } catch (error) { if (error.statusCode !== 409) throw error; }
  }
  const room = rooms[0] || null;
  const actualCheckOutAt = new Date();
  const actualDay = normalizeDate(actualCheckOutAt);
  const contractStart = reservation.checkInDate ? normalizeDate(reservation.checkInDate) : actualDay;
  const releaseFrom = new Date(Math.max(actualDay.getTime(), contractStart.getTime()));
  if (reservation.checkOutDate && releaseFrom < normalizeDate(reservation.checkOutDate)) {
    await releaseInventory({ roomCategoryId: reservation.roomCategory, checkInDate: releaseFrom, checkOutDate: reservation.checkOutDate, roomsCount: reservation.roomsCount, session });
  }
  const from = reservation.status;
  reservation.status = 'checked_out'; reservation.actualCheckOutAt = actualCheckOutAt; reservation.updatedBy = actorId(actingUser);
  reservation.statusHistory.push({ from, to: 'checked_out', changedBy: actorId(actingUser), changedAt: new Date(), reason });
  await reservation.save({ session });
  if (!readiness.allowed && requestedOverride) {
    const snapshot = readiness.financialSnapshot;
    const entry = await appendFinancialLedgerEntry({ eventType: 'hotel_checkout.financial_override', domain: 'hotel', establishmentType: 'Hotel', establishmentId: reservation.hotel, entityType: 'HotelReservation', entityId: reservation._id, relatedEntities: [{ entityType: 'FinancialDocument', entityId: snapshot.documentId }, ...(room ? [{ entityType: 'Room', entityId: room._id }] : [])].filter((item) => item.entityId), actorType: 'user', actorId: actorId(actingUser), amountMinor: snapshot.balanceMinor, currency: snapshot.currency === 'XAF' ? 'XAF' : undefined, businessOperationKey: `hotel-checkout-override:${reservation._id}`, previousState: { status: 'checked_in', financialStatus: 'blocked' }, newState: { status: 'checked_out', financialStatus: 'authorized_by_override' }, metadata: { actorRole: actingUser.role, reason: requestedOverride.reason, ticket: requestedOverride.ticket, blockerCodes: readiness.blockers.map(({ code }) => code), warningCodes: readiness.warnings.map(({ code }) => code), documentTotalMinor: snapshot.documentTotalMinor, allocatedMinor: snapshot.allocatedMinor, balanceMinor: snapshot.balanceMinor, paymentStatus: snapshot.paymentStatus, requestedAt: new Date(), checkoutAt: new Date() } }, { session });
    overrideApplied = true; overrideAuditId = entry._id;
    logger.info('hotel_checkout.financial_override_applied', { reservationId, hotelId: reservation.hotel, actorId: actorId(actingUser), blockerCodes: readiness.blockers.map(({ code }) => code) });
  }
  return { reservation, room, rooms, readiness, overrideApplied, overrideAuditId };
}

async function performCheckOut({ reservation, reservationId, actingUser, reason = '', financialOverride, transactionMode = 'fallback', notificationDependencies = {} }) {
  const id = reservationId || reservation?._id;
  const result = await runFinancialOperation({ operationName: 'hotel.checkout.financial', transactionMode }, ({ session }) => performCheckOutCore({ reservationId: id, reservationSeed: reservation, actingUser, reason, financialOverride, session }));
  if (result.rooms.length) await notifyStaff({ type: 'housekeeping_task_created', title: '🧹 Nouvelles tâches de ménage', body: `${result.rooms.length} tâche(s) de ménage ont été créées.`, entityType: 'HotelReservation', entityId: result.reservation._id, data: { reservationId: String(result.reservation._id), hotelId: String(result.reservation.hotel), roomIds: result.rooms.map((room) => String(room._id)) } }).catch((error) => logger.error('hotel_checkout.post_commit_effect_failed', { reservationId: id, effect: 'housekeeping_notification', errorCode: error.code }));
  await notifyReservationGuest({ reservation: result.reservation, eventKey: 'checked_out', type: 'hotel_reservation_checked_out', title: '👋 Check-out effectué', body: `Votre séjour ${result.reservation.reference} est terminé. Merci de votre visite !`, ...notificationDependencies }).catch((error) => logger.error('hotel_checkout.post_commit_effect_failed', { reservationId: id, effect: 'guest_notification', errorCode: error.code }));
  logger.info('hotel_checkout.completed', { reservationId: id, hotelId: result.reservation.hotel, actorId: actorId(actingUser), overrideApplied: result.overrideApplied });
  await emitHotelEvent(result.reservation.hotel, { eventType: 'reservation.checked_out', entityType: 'HotelReservation', entityId: result.reservation._id, status: result.reservation.status }).catch(() => {});
  return { reservation: result.reservation, room: result.room, rooms: result.rooms, financialCheckout: { status: result.overrideApplied ? 'overridden' : result.readiness.status, warnings: result.readiness.warnings, overrideApplied: result.overrideApplied, overrideAuditId: result.overrideAuditId } };
}
module.exports = { performCheckOut, validateOverride };
