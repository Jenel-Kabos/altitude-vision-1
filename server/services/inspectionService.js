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
const { syncPhysicalInventoryBlock } = require('./hotelAvailabilityService');
const { runFinancialOperation } = require('./finance/financialTransactionService');

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function createInspectionCore({ roomId, housekeepingTaskId, inspectorId, notes = '', actingUser, session = null }) {
  const roomQuery = Room.findById(roomId); const room = await (session ? roomQuery.session(session) : roomQuery);
  if (!room) throw fail('Chambre introuvable.', 404);

  const ticketQuery = MaintenanceTicket.findOne({ room: roomId, status: { $in: MaintenanceTicket.OPEN_MAINTENANCE_STATUSES } });
  const openMaintenanceTicket = await (session ? ticketQuery.session(session) : ticketQuery);
  // Une chambre peut déjà être revenue en nettoyage/inspection après une
  // réaffectation alors que son blocage commercial de maintenance subsiste.
  // Le rattachement au ticket évite de compter deux fois ce même blocage.
  const fromOutOfService = room.status === 'out_of_service' || Boolean(openMaintenanceTicket);
  if (room.status === 'out_of_service') {
    // Ré-inspection post-maintenance (mission §9 : out_of_service →
    // inspection) — transition atomique, jamais une écriture aveugle.
    const updated = await Room.findOneAndUpdate(
      { _id: roomId, status: 'out_of_service' },
      { $set: { status: 'inspection', updatedBy: actingUser?.id || null } },
      session ? { new: true, session } : { new: true },
    );
    if (!updated) throw fail("La chambre n'est plus hors service.", 409);
  } else if (room.status !== 'inspection') {
    throw fail("Cette chambre n'attend pas d'inspection.", 409);
  }

  const data = { room: roomId, housekeepingTask: housekeepingTaskId, inspector: inspectorId, notes, fromOutOfService };
  try {
    const inspection = session ? (await RoomInspection.create([data], { session }))[0] : await RoomInspection.create(data);
    return inspection;
  } catch (error) {
    // E11000 : une inspection ouverte existe déjà pour cette chambre —
    // l'index unique partiel {room, result:null} a fait son travail (deux
    // créations concurrentes lisent toutes deux room.status === 'inspection'
    // sans le réclamer atomiquement).
    if (error.code === 11000) throw fail('Une inspection est déjà ouverte pour cette chambre.', 409);
    throw error;
  }
}

async function createInspection({ roomId, housekeepingTaskId, inspectorId, notes = '', actingUser, transactionMode = 'fallback' }) {
  return runFinancialOperation({ operationName: 'hotel.inspection.create', transactionMode }, ({ session }) => createInspectionCore({
    roomId, housekeepingTaskId, inspectorId, notes, actingUser, session,
  }));
}

async function approveInspectionCore({ inspectionId, actingUser, session }) {
  const inspectionQuery = RoomInspection.findById(inspectionId); const inspection = await (session ? inspectionQuery.session(session) : inspectionQuery);
  if (!inspection) throw fail('Inspection introuvable.', 404);
  if (inspection.result) throw fail('Cette inspection a déjà été tranchée.', 409);

  // Mission §8 : une chambre ne peut redevenir disponible tant qu'un ticket
  // de maintenance ouvert existe — vérifié AVANT toute écriture.
  const ticketQuery = MaintenanceTicket.findOne({
    room: inspection.room, status: { $in: MaintenanceTicket.OPEN_MAINTENANCE_STATUSES },
  });
  const openTicket = await (session ? ticketQuery.session(session) : ticketQuery);
  if (openTicket) {
    throw fail('Un ticket de maintenance est encore ouvert pour cette chambre — impossible de la remettre en service.', 409);
  }

  // Transition de la chambre EN PREMIER (atomique) : si elle échoue,
  // l'inspection n'est jamais marquée "passed" à tort.
  const updatedRoom = await Room.findOneAndUpdate(
    { _id: inspection.room, status: 'inspection' },
    { $set: { status: 'available', updatedBy: actingUser?.id || null } },
    session ? { new: true, session } : { new: true },
  );
  if (!updatedRoom) throw fail("La chambre n'est plus en attente d'inspection.", 409);

  inspection.result = 'passed';
  inspection.inspectedAt = new Date();
  await inspection.save({ session });
  if (inspection.fromOutOfService) await syncPhysicalInventoryBlock({ roomCategoryId: updatedRoom.roomCategory, delta: -1, session });

  return { inspection, room: updatedRoom };
}

async function approveInspection({ inspectionId, actingUser, transactionMode = 'fallback' }) {
  const result = await runFinancialOperation({ operationName: 'hotel.inspection.approve', transactionMode }, ({ session }) => approveInspectionCore({ inspectionId, actingUser, session }));

  await notifyStaff({
    type: 'room_returned_to_service',
    title: '🔓 Chambre remise en service',
    body: 'Une chambre a passé son inspection et est de nouveau disponible.',
    data: { roomId: String(result.room._id), inspectionId: String(result.inspection._id) },
  }).catch(() => {});

  return result;
}

async function rejectInspectionCore({ inspectionId, actingUser, notes = '', session }) {
  const inspectionQuery = RoomInspection.findById(inspectionId); const inspection = await (session ? inspectionQuery.session(session) : inspectionQuery);
  if (!inspection) throw fail('Inspection introuvable.', 404);
  if (inspection.result) throw fail('Cette inspection a déjà été tranchée.', 409);

  const updatedRoom = await Room.findOneAndUpdate(
    { _id: inspection.room, status: 'inspection' },
    { $set: { status: 'out_of_service', updatedBy: actingUser?.id || null } },
    session ? { new: true, session } : { new: true },
  );
  if (!updatedRoom) throw fail("La chambre n'est plus en attente d'inspection.", 409);

  inspection.result = 'failed';
  inspection.inspectedAt = new Date();
  if (notes) inspection.notes = inspection.notes ? `${inspection.notes} — ${notes}` : notes;
  await inspection.save({ session });
  if (!inspection.fromOutOfService) await syncPhysicalInventoryBlock({ roomCategoryId: updatedRoom.roomCategory, delta: 1, session });

  return { inspection, room: updatedRoom };
}

async function rejectInspection({ inspectionId, actingUser, notes = '', transactionMode = 'fallback' }) {
  const result = await runFinancialOperation({ operationName: 'hotel.inspection.reject', transactionMode }, ({ session }) => rejectInspectionCore({ inspectionId, actingUser, notes, session }));

  await notifyStaff({
    type: 'room_inspection_failed',
    title: '❌ Inspection échouée',
    body: 'Une inspection a échoué — la chambre est mise hors service.',
    data: { roomId: String(result.room._id), inspectionId: String(result.inspection._id) },
  }).catch(() => {});

  return result;
}

module.exports = { createInspection, approveInspection, rejectInspection };
