// server/controllers/maintenanceController.js — Sprint E
//
// Contrôleurs fins : toute la logique (transitions, notifications) reste
// dans maintenanceService.js. Même convention d'ownership que
// housekeepingController.js.

const mongoose = require('mongoose');
const Room = require('../models/Room');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const maintenanceService = require('../services/maintenanceService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { assertOperationalHotelAccess, listAccessibleHotels } = require('../services/hotel/hotelAccessScopeService');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message });

// F2.6.1 : remplace le bypass STAFF_ROLES par le scope central — un rôle global
// (Collaborateur/GestionnaireImmobilier/CommunityManager/Prestataire) ne suffit plus seul.
async function assertHotelAccess(req, hotelId, capability) {
  return assertOperationalHotelAccess({ actor: req.user, hotelId, capability });
}

async function loadTicketWithAccess(req, ticketId, capability) {
  if (!mongoose.isValidObjectId(ticketId)) return { error: 400 };
  const ticket = await MaintenanceTicket.findById(ticketId);
  if (!ticket) return { error: 404 };
  const { error } = await assertHotelAccess(req, ticket.hotel, capability);
  if (error) return { error };
  return { ticket };
}

// ─────────────────────────────────────────────
// GET /api/maintenance — dashboard maintenance (mission §11)
// ─────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { hotelId, status, priority, category } = req.query;

    const query = {};
    if (hotelId) {
      if (!mongoose.isValidObjectId(hotelId)) return fail(res, 400, 'Identifiant invalide.');
      const { error } = await assertHotelAccess(req, hotelId, CAP.MAINTENANCE_VIEW);
      if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
      if (error === 403) return fail(res, 403, 'Vous ne pouvez consulter que vos propres hôtels.');
      query.hotel = hotelId;
    } else {
      // F2.6.1 : mêmes garanties que housekeeping.list — scope réel, aucune fuite de count.
      const { globalAccess, hotels } = await listAccessibleHotels(req.user);
      if (!globalAccess) query.hotel = { $in: hotels.map((h) => h._id) };
    }
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const tickets = await MaintenanceTicket.find(query)
      .populate('room', 'roomNumber floor status')
      .populate('hotel', 'name')
      .populate('assignedTo', 'name')
      // Nécessaire pour permettre au dashboard de déclencher une
      // ré-inspection post-maintenance sans redemander l'id de la tâche de
      // ménage d'origine (mission §9 : out_of_service → inspection).
      .populate({ path: 'inspection', populate: { path: 'housekeepingTask', select: '_id' } })
      .sort({ createdAt: -1 });

    res.json({ status: 'success', data: { tickets } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/maintenance
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { roomId, hotelId, inspectionId, category, priority, description } = req.body;
    if (!mongoose.isValidObjectId(hotelId) || !mongoose.isValidObjectId(roomId)) {
      return fail(res, 422, 'Identifiants invalides.');
    }
    const { error } = await assertHotelAccess(req, hotelId, CAP.MAINTENANCE_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');
    if (!MaintenanceTicket.MAINTENANCE_CATEGORIES.includes(category)) return fail(res, 422, 'Catégorie invalide.');
    if (!description || !String(description).trim()) return fail(res, 422, 'La description du problème est requise.');

    const room = await Room.findOne({ _id: roomId, hotel: hotelId });
    if (!room) return fail(res, 404, 'Chambre introuvable pour cet hôtel.');

    const ticket = await maintenanceService.createTicket({
      roomId, hotelId, inspectionId: inspectionId || null, category,
      priority: priority || 'normal', description, actingUser: req.user, transactionMode: 'auto',
    });

    logAction({
      action: 'Ticket de maintenance créé', description: `Ticket ${category} créé pour la chambre ${room.roomNumber}`, module: 'Altimmo',
      typeAction: 'CREATION', auteur: buildAuteur(req.user),
      cible: { id: String(ticket._id), type: 'MaintenanceTicket', nom: room.roomNumber }, req,
    });

    res.status(201).json({ status: 'success', data: { ticket } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/maintenance/:id/assign
// ─────────────────────────────────────────────
exports.assign = async (req, res) => {
  try {
    const { error, ticket } = await loadTicketWithAccess(req, req.params.id, CAP.MAINTENANCE_MANAGE);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Ticket introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const { assignedToUserId } = req.body;
    if (!mongoose.isValidObjectId(assignedToUserId)) return fail(res, 422, 'Technicien invalide.');

    const updated = await maintenanceService.assignTicket({ ticketId: ticket._id, assignedToUserId, actingUser: req.user });
    res.json({ status: 'success', data: { ticket: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/maintenance/:id/start
// ─────────────────────────────────────────────
exports.start = async (req, res) => {
  try {
    const { error, ticket } = await loadTicketWithAccess(req, req.params.id, CAP.MAINTENANCE_MANAGE);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Ticket introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const updated = await maintenanceService.startWork({ ticketId: ticket._id, actingUser: req.user });
    res.json({ status: 'success', data: { ticket: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/maintenance/:id/resolve
// ─────────────────────────────────────────────
exports.resolve = async (req, res) => {
  try {
    const { error, ticket } = await loadTicketWithAccess(req, req.params.id, CAP.MAINTENANCE_MANAGE);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Ticket introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const updated = await maintenanceService.resolveTicket({ ticketId: ticket._id, actingUser: req.user });
    res.json({ status: 'success', data: { ticket: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/maintenance/:id/close
// ─────────────────────────────────────────────
exports.close = async (req, res) => {
  try {
    const { error, ticket } = await loadTicketWithAccess(req, req.params.id, CAP.MAINTENANCE_CLOSE);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Ticket introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const updated = await maintenanceService.closeTicket({ ticketId: ticket._id, actingUser: req.user });
    res.json({ status: 'success', data: { ticket: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};
