// server/services/inspectionService.js — Sprint E
//
// Une RoomInspection est créée quand une chambre atteint le statut
// 'inspection' — soit après un nettoyage terminé (Room.status: cleaning →
// inspection, voir housekeepingService.completeTask), soit après une
// maintenance résolue sur une chambre 'out_of_service' (Room.status:
// out_of_service → inspection, géré ici même — mission §9). `result` reste
// `null` jusqu'à approveInspection/rejectInspection.

const Room = require('../models/Room');
const RoomInspection = require('../models/RoomInspection');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const { notifyStaff } = require('./notificationService');

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function createInspection({ roomId, housekeepingTaskId, inspectorId, notes = '', actingUser }) {
  const room = await Room.findById(roomId);
  if (!room) throw fail('Chambre introuvable.', 404);

  if (room.status === 'out_of_service') {
    // Ré-inspection post-maintenance (mission §9 : out_of_service →
    // inspection) — transition atomique, jamais une écriture aveugle.
    const updated = await Room.findOneAndUpdate(
      { _id: roomId, status: 'out_of_service' },
      { $set: { status: 'inspection', updatedBy: actingUser?.id || null } },
      { new: true },
    );
    if (!updated) throw fail("La chambre n'est plus hors service.", 409);
  } else if (room.status !== 'inspection') {
    throw fail("Cette chambre n'attend pas d'inspection.", 409);
  }

  const inspection = await RoomInspection.create({
    room: roomId, housekeepingTask: housekeepingTaskId, inspector: inspectorId, notes,
  });
  return inspection;
}

async function approveInspection({ inspectionId, actingUser }) {
  const inspection = await RoomInspection.findById(inspectionId);
  if (!inspection) throw fail('Inspection introuvable.', 404);
  if (inspection.result) throw fail('Cette inspection a déjà été tranchée.', 409);

  // Mission §8 : une chambre ne peut redevenir disponible tant qu'un ticket
  // de maintenance ouvert existe — vérifié AVANT toute écriture.
  const openTicket = await MaintenanceTicket.findOne({
    room: inspection.room, status: { $in: MaintenanceTicket.OPEN_MAINTENANCE_STATUSES },
  });
  if (openTicket) {
    throw fail('Un ticket de maintenance est encore ouvert pour cette chambre — impossible de la remettre en service.', 409);
  }

  // Transition de la chambre EN PREMIER (atomique) : si elle échoue,
  // l'inspection n'est jamais marquée "passed" à tort.
  const updatedRoom = await Room.findOneAndUpdate(
    { _id: inspection.room, status: 'inspection' },
    { $set: { status: 'available', updatedBy: actingUser?.id || null } },
    { new: true },
  );
  if (!updatedRoom) throw fail("La chambre n'est plus en attente d'inspection.", 409);

  inspection.result = 'passed';
  inspection.inspectedAt = new Date();
  await inspection.save();

  await notifyStaff({
    type: 'room_returned_to_service',
    title: '🔓 Chambre remise en service',
    body: 'Une chambre a passé son inspection et est de nouveau disponible.',
    data: { roomId: String(updatedRoom._id), inspectionId: String(inspection._id) },
  }).catch(() => {});

  return { inspection, room: updatedRoom };
}

async function rejectInspection({ inspectionId, actingUser, notes = '' }) {
  const inspection = await RoomInspection.findById(inspectionId);
  if (!inspection) throw fail('Inspection introuvable.', 404);
  if (inspection.result) throw fail('Cette inspection a déjà été tranchée.', 409);

  const updatedRoom = await Room.findOneAndUpdate(
    { _id: inspection.room, status: 'inspection' },
    { $set: { status: 'out_of_service', updatedBy: actingUser?.id || null } },
    { new: true },
  );
  if (!updatedRoom) throw fail("La chambre n'est plus en attente d'inspection.", 409);

  inspection.result = 'failed';
  inspection.inspectedAt = new Date();
  if (notes) inspection.notes = inspection.notes ? `${inspection.notes} — ${notes}` : notes;
  await inspection.save();

  await notifyStaff({
    type: 'room_inspection_failed',
    title: '❌ Inspection échouée',
    body: 'Une inspection a échoué — la chambre est mise hors service.',
    data: { roomId: String(updatedRoom._id), inspectionId: String(inspection._id) },
  }).catch(() => {});

  return { inspection, room: updatedRoom };
}

module.exports = { createInspection, approveInspection, rejectInspection };
