// server/controllers/inspectionController.js — Sprint E
//
// Contrôleurs fins : toute la logique (transitions de chambre, garde
// "ticket de maintenance ouvert", notifications) reste dans
// inspectionService.js. Ownership résolue via la chambre (Room.hotel) —
// jamais un :hotelId d'URL séparé, même convention que
// roomAssignmentController.js (Sprint D).

const mongoose = require('mongoose');
const Room = require('../models/Room');
const RoomInspection = require('../models/RoomInspection');
const inspectionService = require('../services/inspectionService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { assertOperationalHotelAccess } = require('../services/hotel/hotelAccessScopeService');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message });

// F2.6.1 : remplace le bypass STAFF_ROLES par le scope central. Un inspecteur A ne peut plus
// approuver/rejeter une inspection B même en connaissant son identifiant.
async function assertHotelAccess(req, hotelId, capability) {
  return assertOperationalHotelAccess({ actor: req.user, hotelId, capability });
}

async function loadInspectionWithAccess(req, inspectionId, capability) {
  if (!mongoose.isValidObjectId(inspectionId)) return { error: 400 };
  const inspection = await RoomInspection.findById(inspectionId);
  if (!inspection) return { error: 404 };
  const room = await Room.findById(inspection.room);
  if (!room) return { error: 404 };
  const { error } = await assertHotelAccess(req, room.hotel, capability);
  if (error) return { error };
  return { inspection, room };
}

// ─────────────────────────────────────────────
// POST /api/inspections
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { roomId, housekeepingTaskId, notes } = req.body;
    if (!mongoose.isValidObjectId(roomId) || !mongoose.isValidObjectId(housekeepingTaskId)) {
      return fail(res, 422, 'Identifiants invalides.');
    }
    const room = await Room.findById(roomId);
    if (!room) return fail(res, 404, 'Chambre introuvable.');
    const { error } = await assertHotelAccess(req, room.hotel, CAP.INSPECTION_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const inspection = await inspectionService.createInspection({
      roomId, housekeepingTaskId, inspectorId: req.user.id, notes: notes || '', actingUser: req.user, transactionMode: 'auto',
    });

    logAction({
      action: 'Inspection créée', description: `Inspection créée pour la chambre ${room.roomNumber}`, module: 'Altimmo',
      typeAction: 'CRÉATION', auteur: buildAuteur(req.user),
      cible: { id: String(inspection._id), type: 'RoomInspection', nom: room.roomNumber }, req,
    });

    res.status(201).json({ status: 'success', data: { inspection } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/inspections/:id/approve
// ─────────────────────────────────────────────
exports.approve = async (req, res) => {
  try {
    const { error } = await loadInspectionWithAccess(req, req.params.id, CAP.INSPECTION_APPROVE);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Inspection introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const result = await inspectionService.approveInspection({ inspectionId: req.params.id, actingUser: req.user, transactionMode: 'auto' });

    logAction({
      action: 'Inspection approuvée', description: `Inspection approuvée — chambre ${result.room.roomNumber} remise en service`, module: 'Altimmo',
      typeAction: 'VALIDATION', auteur: buildAuteur(req.user),
      cible: { id: String(result.inspection._id), type: 'RoomInspection', nom: result.room.roomNumber }, req,
    });

    res.json({ status: 'success', data: result });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/inspections/:id/reject
// ─────────────────────────────────────────────
exports.reject = async (req, res) => {
  try {
    const { error } = await loadInspectionWithAccess(req, req.params.id, CAP.INSPECTION_REJECT);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Inspection introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');

    const result = await inspectionService.rejectInspection({
      inspectionId: req.params.id, actingUser: req.user, notes: req.body?.notes || '', transactionMode: 'auto',
    });

    logAction({
      action: 'Inspection rejetée', description: `Inspection échouée — chambre ${result.room.roomNumber} hors service`, module: 'Altimmo',
      typeAction: 'REJET', auteur: buildAuteur(req.user),
      cible: { id: String(result.inspection._id), type: 'RoomInspection', nom: result.room.roomNumber }, req,
    });

    res.json({ status: 'success', data: result });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};
