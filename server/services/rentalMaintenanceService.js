// server/services/rentalMaintenanceService.js — Sprint GL-B2
//
// Centralise toutes les transitions de RentalMaintenanceTicket — jamais
// dans un contrôleur. Domaine dédié à la gestion locative, indépendant du
// maintenanceService.js hôtelier (Sprint E).

const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const RentalManagement = require('../models/RentalManagement');
const Locataire = require('../models/Locataire');
const { notify, notifyStaff } = require('./notificationService');

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertTransition(current, next) {
  const allowed = RentalMaintenanceTicket.RENTAL_MAINTENANCE_STATUS_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw fail(`Transition invalide : ${current} → ${next}.`, 409);
  }
}

// ─────────────────────────────────────────────
// Dette technique GL-B2 (Mission 6) — RentalMaintenanceTicket et
// RentalManagement.maintenanceStatus étaient deux sources de vérité non
// synchronisées. `maintenanceStatus` devient un CACHE DÉRIVÉ, recalculé ici
// après chaque transition qui change le nombre de tickets ouverts (create/
// resolve/close) — jamais écrit ailleurs pour ce cas d'usage précis.
//
// `controle_requis` reste un statut manuel (post-inspection, action
// `completeMaintenance` existante, Sprint A) — jamais écrasé
// automatiquement par cette synchronisation, pour ne pas casser le
// workflow de validation déjà en production.
async function syncRentalManagementMaintenanceStatus(propertyId) {
  if (!propertyId) return;
  const rental = await RentalManagement.findOne({ property: propertyId });
  if (!rental || rental.maintenanceStatus === 'controle_requis') return;

  const openCount = await RentalMaintenanceTicket.countDocuments({
    property: propertyId, status: { $in: RentalMaintenanceTicket.OPEN_RENTAL_MAINTENANCE_STATUSES },
  });

  const nextStatus = openCount > 0 ? 'en_cours' : 'aucune';
  if (rental.maintenanceStatus !== nextStatus) {
    rental.maintenanceStatus = nextStatus;
    await rental.save();
  }
}

async function createTicket({
  propertyId, leaseId = null, tenantId = null, ownerId = null,
  category, priority = 'normale', description, estimatedCost = null, attachments = [], actingUser, tenantUserId = null,
}) {
  const ticket = await RentalMaintenanceTicket.create({
    property: propertyId, lease: leaseId, tenant: tenantId, owner: ownerId,
    category, priority, description, estimatedCost, attachments,
    createdBy: actingUser?.id || null,
  });

  await syncRentalManagementMaintenanceStatus(propertyId);

  await notifyStaff({
    type: 'rental_maintenance_ticket_created',
    title: '🔧 Ticket de maintenance locative créé',
    body: `Un ticket de maintenance (${category}) a été créé.`,
    data: { ticketId: String(ticket._id), propertyId: String(propertyId) },
  }).catch(() => {});
  if (tenantUserId) await notify({ recipient: tenantUserId, type: 'tenant_maintenance_created', title: 'Demande de maintenance créée', body: 'Votre demande a bien été transmise au gestionnaire.', data: { ticketId: String(ticket._id) } }).catch(() => {});

  return ticket;
}

async function assignTicket({ ticketId, assignedToUserId, actingUser }) {
  const ticket = await RentalMaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket introuvable.', 404);
  if (ticket.status !== 'assigne') assertTransition(ticket.status, 'assigne');

  ticket.assignedTo = assignedToUserId;
  ticket.status = 'assigne';
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();

  if (assignedToUserId) {
    await notify({
      recipient: assignedToUserId,
      type: 'rental_maintenance_ticket_assigned',
      title: '🔧 Ticket de maintenance assigné',
      body: 'Un ticket de maintenance locative vous a été assigné.',
      data: { ticketId: String(ticket._id) },
    }).catch(() => {});
  }

  return ticket;
}

async function scheduleTicket({ ticketId, scheduledFor, actingUser }) {
  const ticket = await RentalMaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket introuvable.', 404);
  if (ticket.status !== 'planifie') assertTransition(ticket.status, 'planifie');

  const date = new Date(scheduledFor);
  if (!scheduledFor || Number.isNaN(date.getTime())) throw fail('Date de planification invalide.', 422);

  ticket.scheduledFor = date;
  ticket.status = 'planifie';
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();
  if (ticket.tenant) {
    const tenant = await Locataire.findById(ticket.tenant).select('user').lean();
    if (tenant?.user) await notify({ recipient: tenant.user, type: 'tenant_maintenance_scheduled', title: 'Intervention planifiée', body: `Une intervention est planifiée le ${date.toLocaleDateString('fr-FR')}.`, data: { ticketId: String(ticket._id) } }).catch(() => {});
  }
  return ticket;
}

async function startWork({ ticketId, actingUser }) {
  const ticket = await RentalMaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket introuvable.', 404);
  assertTransition(ticket.status, 'en_cours');

  ticket.status = 'en_cours';
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();
  return ticket;
}

async function resolveTicket({ ticketId, actualCost = null, actingUser }) {
  const ticket = await RentalMaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket introuvable.', 404);
  assertTransition(ticket.status, 'resolu');

  ticket.status = 'resolu';
  ticket.resolvedAt = new Date();
  if (actualCost !== null && actualCost !== undefined) ticket.actualCost = actualCost;
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();

  await syncRentalManagementMaintenanceStatus(ticket.property);

  await notifyStaff({
    type: 'rental_maintenance_ticket_resolved',
    title: '✅ Maintenance locative résolue',
    body: 'Un ticket de maintenance locative a été résolu.',
    data: { ticketId: String(ticket._id), propertyId: String(ticket.property) },
  }).catch(() => {});
  if (ticket.tenant) {
    const tenant = await Locataire.findById(ticket.tenant).select('user').lean();
    if (tenant?.user) await notify({ recipient: tenant.user, type: 'tenant_maintenance_resolved', title: 'Maintenance résolue', body: 'Votre demande de maintenance a été marquée comme résolue.', data: { ticketId: String(ticket._id) } }).catch(() => {});
  }

  return ticket;
}

async function closeTicket({ ticketId, actingUser }) {
  const ticket = await RentalMaintenanceTicket.findById(ticketId);
  if (!ticket) throw fail('Ticket introuvable.', 404);
  assertTransition(ticket.status, 'cloture');

  ticket.status = 'cloture';
  ticket.updatedBy = actingUser?.id || null;
  await ticket.save();
  return ticket;
}

module.exports = {
  createTicket, assignTicket, scheduleTicket, startWork, resolveTicket, closeTicket,
  syncRentalManagementMaintenanceStatus,
};
