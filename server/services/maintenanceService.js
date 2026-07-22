// server/services/maintenanceService.js — Sprint E
//
// Un MaintenanceTicket est toujours ouvert manuellement par le staff
// (jamais auto-généré, contrairement à HousekeepingTask au check-out) —
// une inspection échouée indique QU'un problème existe, pas SA nature
// exacte (catégorie/description). `inspection` fait simplement le lien de
// traçabilité vers l'inspection qui a déclenché la mise hors service.

const MaintenanceTicket = require('../models/MaintenanceTicket');
const { notify, notifyStaff } = require('./notificationService');

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

async function createTicket({
  roomId, hotelId, inspectionId = null, category, priority = 'normal', description, actingUser,
}) {
  const ticket = await MaintenanceTicket.create({
    room: roomId, hotel: hotelId, inspection: inspectionId, category, priority, description,
    createdBy: actingUser?.id || null,
  });

  await notifyStaff({
    type: 'maintenance_ticket_created',
    title: '🔧 Ticket de maintenance créé',
    body: `Un ticket de maintenance (${category}) a été créé.`,
    data: { ticketId: String(ticket._id), roomId: String(roomId) },
  }).catch(() => {});

  return ticket;
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
      data: { ticketId: String(ticket._id) },
    }).catch(() => {});
  }

  return ticket;
}

async function startWork({ ticketId, actingUser }) {
  const ticket = await MaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket de maintenance introuvable.', 404);
  assertTransition(ticket.status, 'in_progress');

  ticket.status = 'in_progress';
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();
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
    data: { ticketId: String(ticket._id), roomId: String(ticket.room) },
  }).catch(() => {});

  return ticket;
}

async function closeTicket({ ticketId, actingUser }) {
  const ticket = await MaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket de maintenance introuvable.', 404);
  assertTransition(ticket.status, 'closed');

  ticket.status = 'closed';
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();
  return ticket;
}

module.exports = {
  createTicket, assignTicket, startWork, resolveTicket, closeTicket,
};
