// server/services/maintenanceService.js — Sprint E
//
// Un MaintenanceTicket est toujours ouvert manuellement par le staff
// (jamais auto-généré, contrairement à HousekeepingTask au check-out) —
// une inspection échouée indique QU'un problème existe, pas SA nature
// exacte (catégorie/description). `inspection` fait simplement le lien de
// traçabilité vers l'inspection qui a déclenché la mise hors service.

const MaintenanceTicket = require('../models/MaintenanceTicket');
const Room = require('../models/Room');
const RoomAssignment = require('../models/RoomAssignment');
const HotelReservation = require('../models/HotelReservation');
const { notify, notifyStaff } = require('./notificationService');
const { syncPhysicalInventoryBlock } = require('./hotelAvailabilityService');
const { runFinancialOperation } = require('./finance/financialTransactionService');
const { emitHotelEvent } = require('../socket');

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertTransition(current, next) {
  const allowed = MaintenanceTicket.MAINTENANCE_STATUS_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw fail(`Transition invalide : ${current} → ${next}.`, 409);
  }
}

async function createTicketCore({ roomId, hotelId, inspectionId, category, priority, description, actingUser, session }) {
  const roomQuery = Room.findOne({ _id: roomId, hotel: hotelId }); const room = await (session ? roomQuery.session(session) : roomQuery);
  if (!room) throw fail('Chambre introuvable pour cet hôtel.', 404);
  const wasBlocked = room.status === 'out_of_service';
  if (!wasBlocked) {
    const updated = await Room.findOneAndUpdate({ _id: roomId, hotel: hotelId, status: { $ne: 'out_of_service' } }, { $set: { status: 'out_of_service', updatedBy: actingUser?.id || null } }, { new: true, session });
    if (!updated) throw fail('La chambre vient de changer d’état.', 409);
    await syncPhysicalInventoryBlock({ roomCategoryId: room.roomCategory, delta: 1, session });
  }
  const assignmentQuery = RoomAssignment.find({ room: roomId, releasedAt: null }); const assignments = await (session ? assignmentQuery.session(session) : assignmentQuery);
  if (assignments.length) await HotelReservation.updateMany({ _id: { $in: assignments.map((item) => item.reservation) }, status: { $in: ['pending', 'confirmed', 'checked_in'] } }, { $set: { requiresRoomReassignment: true, reassignmentReason: 'Chambre hors service — réaffectation requise' } }, { session });
  const data = { room: roomId, hotel: hotelId, inspection: inspectionId, category, priority, description, createdBy: actingUser?.id || null };
  const ticket = session ? (await MaintenanceTicket.create([data], { session }))[0] : await MaintenanceTicket.create(data);
  return { ticket, impactedReservations: assignments.map((item) => item.reservation) };
}

async function createTicket({ roomId, hotelId, inspectionId = null, category, priority = 'normal', description, actingUser, transactionMode = 'fallback' }) {
  const result = await runFinancialOperation({ operationName: 'hotel.maintenance.create', transactionMode }, ({ session }) => createTicketCore({ roomId, hotelId, inspectionId, category, priority, description, actingUser, session }));

  await notifyStaff({
    type: 'maintenance_ticket_created',
    title: '🔧 Ticket de maintenance créé',
    body: `Un ticket de maintenance (${category}) a été créé.`,
    entityType: 'MaintenanceTicket', entityId: result.ticket._id,
    data: { ticketId: String(result.ticket._id), roomId: String(roomId), hotelId: String(hotelId), impactedReservations: result.impactedReservations.map(String) },
  }).catch(() => {});

  await emitHotelEvent(hotelId, { eventType: 'maintenance.created', entityType: 'MaintenanceTicket', entityId: result.ticket._id, status: result.ticket.status }).catch(() => {});

  return result.ticket;
}

async function assignTicket({ ticketId, assignedToUserId, actingUser }) {
  const ticket = await MaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket de maintenance introuvable.', 404);
  // Réaffectation d'un ticket déjà 'assigned' à un autre technicien — pas
  // un changement de statut, la table de transitions ne s'applique qu'aux
  // autres statuts de départ (même logique que housekeepingService).
  if (ticket.status !== 'assigned') assertTransition(ticket.status, 'assigned');

  ticket.assignedTo = assignedToUserId;
  ticket.status = 'assigned';
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();

  if (assignedToUserId) {
    await notify({
      recipient: assignedToUserId,
      type: 'maintenance_ticket_assigned',
      title: '🔧 Ticket de maintenance assigné',
      body: 'Un ticket de maintenance vous a été assigné.',
      audience: 'staff', entityType: 'MaintenanceTicket', entityId: ticket._id,
      data: { ticketId: String(ticket._id), hotelId: String(ticket.hotel) },
    }).catch(() => {});
  }

  await emitHotelEvent(ticket.hotel, { eventType: 'maintenance.assigned', entityType: 'MaintenanceTicket', entityId: ticket._id, status: ticket.status }).catch(() => {});

  return ticket;
}

async function startWork({ ticketId, actingUser }) {
  const ticket = await MaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket de maintenance introuvable.', 404);
  assertTransition(ticket.status, 'in_progress');

  ticket.status = 'in_progress';
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();
  await emitHotelEvent(ticket.hotel, { eventType: 'maintenance.started', entityType: 'MaintenanceTicket', entityId: ticket._id, status: ticket.status }).catch(() => {});
  return ticket;
}

async function resolveTicket({ ticketId, actingUser }) {
  const ticket = await MaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket de maintenance introuvable.', 404);
  assertTransition(ticket.status, 'resolved');

  ticket.status = 'resolved';
  ticket.resolvedAt = new Date();
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();

  await notifyStaff({
    type: 'maintenance_ticket_resolved',
    title: '✅ Maintenance terminée',
    body: 'Un ticket de maintenance a été résolu — la chambre peut être ré-inspectée.',
    entityType: 'MaintenanceTicket', entityId: ticket._id,
    data: { ticketId: String(ticket._id), roomId: String(ticket.room), hotelId: String(ticket.hotel) },
  }).catch(() => {});

  await emitHotelEvent(ticket.hotel, { eventType: 'maintenance.resolved', entityType: 'MaintenanceTicket', entityId: ticket._id, status: ticket.status }).catch(() => {});

  return ticket;
}

async function closeTicket({ ticketId, actingUser }) {
  const ticket = await MaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket de maintenance introuvable.', 404);
  assertTransition(ticket.status, 'closed');

  ticket.status = 'closed';
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();
  await emitHotelEvent(ticket.hotel, { eventType: 'maintenance.closed', entityType: 'MaintenanceTicket', entityId: ticket._id, status: ticket.status }).catch(() => {});
  return ticket;
}

module.exports = {
  createTicket, assignTicket, startWork, resolveTicket, closeTicket,
};
