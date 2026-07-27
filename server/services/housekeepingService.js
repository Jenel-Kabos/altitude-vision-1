// server/services/housekeepingService.js — Sprint E
//
// Centralise toutes les transitions de HousekeepingTask — jamais dans un
// contrôleur. `completeTask` est le point de bascule qui fait revenir une
// chambre nettoyée dans le cycle d'exploitation (cleaning → inspection),
// répondant à l'objectif du sprint : "faire revenir cette chambre dans le
// stock exploitable".
//
// Anti-concurrence : même stratégie que RoomAssignment (Sprint D) — pas de
// transaction MongoDB, mais un index unique partiel (`{room, open:true}`)
// qui convertit toute tentative de double tâche ouverte en erreur E11000,
// interceptée ici et renvoyée en 409 métier propre.

const Room = require('../models/Room');
const HousekeepingTask = require('../models/HousekeepingTask');
const { notify, notifyStaff } = require('./notificationService');
const { runFinancialOperation } = require('./finance/financialTransactionService');

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertTransition(current, next) {
  const allowed = HousekeepingTask.HOUSEKEEPING_STATUS_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw fail(`Transition invalide : ${current} → ${next}.`, 409);
  }
}

/**
 * Crée une tâche de ménage. Utilisée à la fois par le check-out
 * (type 'checkout_cleaning', automatique) et par le staff (refresh/
 * deep_cleaning, manuel) — voir mission §3-4.
 */
async function createTask({ roomId, hotelId, reservationId = null, type, priority = 'normal', notes = '', actingUser, session, notifyAfterCreate = true }) {
  let task;
  try {
    const data = {
      room: roomId,
      hotel: hotelId,
      reservation: reservationId,
      type,
      priority,
      notes,
      createdBy: actingUser?.id || null,
    };
    task = session ? (await HousekeepingTask.create([data], { session }))[0] : await HousekeepingTask.create(data);
  } catch (error) {
    // E11000 : une tâche ouverte existe déjà pour cette chambre — l'index
    // unique partiel {room, open:true} a fait son travail (mission §3 :
    // "ne jamais créer plusieurs tâches ouvertes pour la même chambre").
    if (error.code === 11000) throw fail('Une tâche de ménage est déjà ouverte pour cette chambre.', 409);
    throw error;
  }

  if (notifyAfterCreate) await notifyStaff({
    type: 'housekeeping_task_created',
    title: '🧹 Nouvelle tâche de ménage',
    body: `Une tâche de ménage (${type}) a été créée.`,
    data: { taskId: String(task._id), roomId: String(roomId) },
  }).catch(() => {});

  return task;
}

async function assignTask({ taskId, assignedToUserId, actingUser }) {
  const task = await HousekeepingTask.findById(taskId);
  if (!task) throw fail('Tâche de ménage introuvable.', 404);
  // Une tâche déjà 'assigned' peut être réaffectée à un autre employé (pas
  // un changement de statut, juste une mise à jour de `assignedTo`) — la
  // table de transitions ne s'applique donc qu'aux AUTRES statuts de départ.
  if (task.status !== 'assigned') {
    assertTransition(task.status, 'assigned');
  }

  task.assignedTo = assignedToUserId;
  task.status = 'assigned';
  task.updatedBy = actingUser?.id || null;
  await task.save();

  if (assignedToUserId) {
    await notify({
      recipient: assignedToUserId,
      type: 'housekeeping_task_assigned',
      title: '🧹 Tâche de ménage assignée',
      body: 'Une tâche de ménage vous a été assignée.',
      data: { taskId: String(task._id) },
    }).catch(() => {});
  }

  return task;
}

async function startTask({ taskId, actingUser }) {
  const task = await HousekeepingTask.findById(taskId);
  if (!task) throw fail('Tâche de ménage introuvable.', 404);
  assertTransition(task.status, 'in_progress');

  task.status = 'in_progress';
  task.startedAt = new Date();
  task.updatedBy = actingUser?.id || null;
  await task.save();
  return task;
}

/**
 * Termine une tâche de ménage et fait basculer la chambre vers
 * 'inspection' — le pont central du Sprint E entre nettoyage et
 * inspection (mission : objectif du sprint).
 */
async function completeTaskCore({ taskId, actingUser, session }) {
  const query = HousekeepingTask.findById(taskId);
  const task = await (session ? query.session(session) : query);
  if (!task) throw fail('Tâche de ménage introuvable.', 404);
  assertTransition(task.status, 'completed');

  task.status = 'completed';
  task.open = false;
  task.completedAt = new Date();
  task.updatedBy = actingUser?.id || null;
  await task.save({ session });

  // Transition atomique de la chambre — garde par statut courant, jamais
  // une écriture aveugle (une chambre déjà déplacée entre-temps par une
  // autre opération n'est jamais écrasée silencieusement).
  const room = await Room.findOneAndUpdate(
    { _id: task.room, status: 'cleaning' },
    { $set: { status: 'inspection', updatedBy: actingUser?.id || null } },
    session ? { new: true, session } : { new: true },
  );
  if (!room) throw fail("La chambre n'est plus en état de nettoyage.", 409);

  return { task, room };
}

async function completeTask({ taskId, actingUser, transactionMode = 'fallback' }) {
  const result = await runFinancialOperation({ operationName: 'hotel.housekeeping.complete', transactionMode }, ({ session }) => completeTaskCore({ taskId, actingUser, session }));

  await notifyStaff({
    type: 'housekeeping_task_completed',
    title: '✅ Nettoyage terminé',
    body: 'Un nettoyage est terminé et la chambre attend son inspection.',
    data: { taskId: String(result.task._id), roomId: String(result.task.room) },
  }).catch(() => {});

  return result.task;
}

async function cancelTask({ taskId, actingUser, reason = '' }) {
  const task = await HousekeepingTask.findById(taskId);
  if (!task) throw fail('Tâche de ménage introuvable.', 404);
  assertTransition(task.status, 'cancelled');

  task.status = 'cancelled';
  task.open = false;
  if (reason) task.notes = task.notes ? `${task.notes} — ${reason}` : reason;
  task.updatedBy = actingUser?.id || null;
  await task.save();
  return task;
}

module.exports = {
  createTask, assignTask, startTask, completeTask, cancelTask,
};
