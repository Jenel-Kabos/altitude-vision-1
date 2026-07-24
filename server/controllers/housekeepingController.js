// server/controllers/housekeepingController.js — Sprint E
//
// Contrôleurs fins : toute la logique (transitions, anti double-tâche
// ouverte, notifications) reste dans housekeepingService.js. Même
// convention d'ownership que roomController.js (Sprint D) — propriétaire de
// l'hôtel ou staff (STAFF_ROLES), jamais le client (mission §14).

const mongoose = require('mongoose');
const Room = require('../models/Room');
const HousekeepingTask = require('../models/HousekeepingTask');
const housekeepingService = require('../services/housekeepingService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { assertOperationalHotelAccess, listAccessibleHotels } = require('../services/hotel/hotelAccessScopeService');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message });

// F2.6.1 : remplace le bypass STAFF_ROLES par le scope central (Admin, Hotel.manager legacy,
// ou HotelStaffAssignment actif avec la capacité requise sur CET hôtel précis).
async function assertHotelAccess(req, hotelId, capability) {
  return assertOperationalHotelAccess({ actor: req.user, hotelId, capability });
}

async function loadTaskWithAccess(req, taskId, capability) {
  if (!mongoose.isValidObjectId(taskId)) return { error: 400 };
  const task = await HousekeepingTask.findById(taskId);
  if (!task) return { error: 404 };
  const { error } = await assertHotelAccess(req, task.hotel, capability);
  if (error) return { error };
  return { task };
}

// ─────────────────────────────────────────────
// GET /api/housekeeping — dashboard ménage (mission §10)
// ─────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { hotelId, status, priority } = req.query;

    const query = {};
    if (hotelId) {
      if (!mongoose.isValidObjectId(hotelId)) return fail(res, 400, 'Identifiant invalide.');
      const { error } = await assertHotelAccess(req, hotelId, CAP.HOUSEKEEPING_VIEW);
      if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
      if (error === 403) return fail(res, 403, 'Vous ne pouvez consulter que vos propres hôtels.');
      query.hotel = hotelId;
    } else {
      // F2.6.1 : aucun `hotelId` fourni — le scope vient exclusivement des hôtels réellement
      // accessibles (Admin = tous, sinon rattachements HotelStaffAssignment actifs + legacy
      // Hotel.manager), jamais d'un bypass de rôle. Le total/count suit le même filtre que la
      // liste (aucune fuite, mission §19).
      const { globalAccess, hotels } = await listAccessibleHotels(req.user);
      if (!globalAccess) query.hotel = { $in: hotels.map((h) => h._id) };
    }
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tasks = await HousekeepingTask.find(query)
      .populate('room', 'roomNumber floor')
      .populate('hotel', 'name')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    res.json({ status: 'success', data: { tasks } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/housekeeping
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { roomId, hotelId, reservationId, type, priority, notes } = req.body;
    if (!mongoose.isValidObjectId(hotelId) || !mongoose.isValidObjectId(roomId)) {
      return fail(res, 422, 'Identifiants invalides.');
    }
    const { error } = await assertHotelAccess(req, hotelId, CAP.HOUSEKEEPING_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');
    if (!HousekeepingTask.HOUSEKEEPING_TYPES.includes(type)) return fail(res, 422, 'Type de tâche invalide.');

    const room = await Room.findOne({ _id: roomId, hotel: hotelId });
    if (!room) return fail(res, 404, 'Chambre introuvable pour cet hôtel.');

    const task = await housekeepingService.createTask({
      roomId, hotelId, reservationId: reservationId || null, type,
      priority: priority || 'normal', notes: notes || '', actingUser: req.user,
    });

    logAction({
      action: 'Tâche de ménage créée', description: `Tâche ${task.type} créée pour la chambre ${room.roomNumber}`, module: 'Altimmo',
      typeAction: 'CREATION', auteur: buildAuteur(req.user),
      cible: { id: String(task._id), type: 'HousekeepingTask', nom: room.roomNumber }, req,
    });

    res.status(201).json({ status: 'success', data: { task } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/housekeeping/:id/assign
// ─────────────────────────────────────────────
exports.assign = async (req, res) => {
  try {
    const { error, task } = await loadTaskWithAccess(req, req.params.id, CAP.HOUSEKEEPING_MANAGE);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Tâche introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const { assignedToUserId } = req.body;
    if (!mongoose.isValidObjectId(assignedToUserId)) return fail(res, 422, 'Employé invalide.');

    const updated = await housekeepingService.assignTask({ taskId: task._id, assignedToUserId, actingUser: req.user });
    res.json({ status: 'success', data: { task: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/housekeeping/:id/start
// ─────────────────────────────────────────────
exports.start = async (req, res) => {
  try {
    const { error, task } = await loadTaskWithAccess(req, req.params.id, CAP.HOUSEKEEPING_MANAGE);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Tâche introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const updated = await housekeepingService.startTask({ taskId: task._id, actingUser: req.user });
    res.json({ status: 'success', data: { task: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/housekeeping/:id/complete
// ─────────────────────────────────────────────
exports.complete = async (req, res) => {
  try {
    const { error, task } = await loadTaskWithAccess(req, req.params.id, CAP.HOUSEKEEPING_COMPLETE);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Tâche introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const updated = await housekeepingService.completeTask({ taskId: task._id, actingUser: req.user });

    logAction({
      action: 'Tâche de ménage terminée', description: `Tâche ${updated._id} terminée — chambre en attente d'inspection`, module: 'Altimmo',
      typeAction: 'MODIFICATION', auteur: buildAuteur(req.user),
      cible: { id: String(updated._id), type: 'HousekeepingTask' }, req,
    });

    res.json({ status: 'success', data: { task: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/housekeeping/:id/cancel
// ─────────────────────────────────────────────
exports.cancel = async (req, res) => {
  try {
    const { error, task } = await loadTaskWithAccess(req, req.params.id, CAP.HOUSEKEEPING_MANAGE);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Tâche introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const updated = await housekeepingService.cancelTask({ taskId: task._id, actingUser: req.user, reason: req.body?.reason || '' });
    res.json({ status: 'success', data: { task: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};
