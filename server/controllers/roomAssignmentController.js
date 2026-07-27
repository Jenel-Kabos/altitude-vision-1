// server/controllers/roomAssignmentController.js — Sprint D
//
// Contrôleurs fins : toute la logique (anti double-affectation, ordre
// réserver-puis-libérer) reste dans roomAssignmentService.js. L'accès est
// résolu via l'hôtel de LA RÉSERVATION (jamais un paramètre d'URL séparé) —
// mission §13 : le propriétaire ne gère que ses propres hôtels.

const mongoose = require('mongoose');
const HotelReservation = require('../models/HotelReservation');
const { assignRoom, autoAssignRooms, changeRoom, releaseRoom } = require('../services/roomAssignmentService');
const { notifyReservationGuest } = require('../services/hotelReservationNotificationService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { assertOperationalHotelAccess } = require('../services/hotel/hotelAccessScopeService');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message });

// F2.6.1 : l'hôtel vient toujours de la réservation persistée (jamais d'un paramètre séparé) ;
// l'accès staff passe désormais par le scope central (Hotel.manager legacy ou
// HotelStaffAssignment actif), plus le bypass STAFF_ROLES sans vérification de rattachement.
async function loadReservationWithAccess(req, reservationId) {
  if (!mongoose.isValidObjectId(reservationId)) return { error: 400 };
  const reservation = await HotelReservation.findById(reservationId);
  if (!reservation) return { error: 404 };
  const { error } = await assertOperationalHotelAccess({ actor: req.user, hotelId: reservation.hotel, capability: CAP.ROOM_ASSIGNMENT_MANAGE });
  if (error) return { error: error === 404 ? 404 : 403 };
  return { reservation };
}

async function notifyGuestRoomEvent(reservation, type, title, body) {
  await notifyReservationGuest({ reservation, eventKey: type, type, title, body }).catch(() => {});
}

// ─────────────────────────────────────────────
// POST /api/hotels/room-assignments — affecter une chambre
// ─────────────────────────────────────────────
exports.assign = async (req, res) => {
  try {
    const { reservationId, roomId, reason } = req.body;
    const { error, reservation } = await loadReservationWithAccess(req, reservationId);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Réservation introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que les réservations de vos propres hôtels.");
    if (!mongoose.isValidObjectId(roomId)) return fail(res, 422, 'Chambre invalide.');

    const assignment = await assignRoom({ reservationId, roomId, reservation, actingUser: req.user, reason: reason || '', transactionMode: 'auto' });

    logAction({
      action: 'Chambre affectée', description: `Réservation ${reservation.reference} → chambre affectée`, module: 'Altimmo',
      typeAction: 'MODIFICATION', auteur: buildAuteur(req.user),
      cible: { id: String(reservation._id), type: 'HotelReservation', nom: reservation.reference }, req,
    });
    await notifyGuestRoomEvent(reservation, 'hotel_room_assigned', '🛏️ Chambre affectée', `Une chambre a été affectée à votre réservation ${reservation.reference}.`);

    res.status(201).json({ status: 'success', data: { assignment } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.autoAssign = async (req, res) => {
  try {
    const { reservationId, reason } = req.body;
    const { error, reservation } = await loadReservationWithAccess(req, reservationId);
    if (error) return fail(res, error, error === 403 ? 'Accès refusé.' : 'Réservation introuvable.');
    const assignments = await autoAssignRooms({ reservationId, reservation, actingUser: req.user, reason, transactionMode: 'auto' });
    logAction({ action: 'Affectation automatique', description: `${assignments.length}/${reservation.roomsCount} chambre(s) affectée(s)`, module: 'Altimmo', typeAction: 'MODIFICATION', auteur: buildAuteur(req.user), cible: { id: String(reservation._id), type: 'HotelReservation', nom: reservation.reference }, req });
    await notifyGuestRoomEvent(reservation, 'hotel_rooms_assigned', '🛏️ Chambres affectées', `Les chambres de votre réservation ${reservation.reference} ont été affectées.`);
    return res.json({ status: 'success', data: { assignments, assignmentState: assignments.length === reservation.roomsCount ? 'fully_assigned' : 'partially_assigned' } });
  } catch (error) { return fail(res, error.statusCode || 500, error.message); }
};

// ─────────────────────────────────────────────
// PATCH /api/hotels/room-assignments/change — changer de chambre
// ─────────────────────────────────────────────
exports.change = async (req, res) => {
  try {
    const { reservationId, oldRoomId, newRoomId, reason } = req.body;
    const { error, reservation } = await loadReservationWithAccess(req, reservationId);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Réservation introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que les réservations de vos propres hôtels.");
    if (!mongoose.isValidObjectId(newRoomId)) return fail(res, 422, 'Chambre invalide.');

    const assignment = await changeRoom({ reservationId, oldRoomId, newRoomId, reservation, actingUser: req.user, reason: reason || '', transactionMode: 'auto' });

    logAction({
      action: 'Chambre changée', description: `Réservation ${reservation.reference} → changement de chambre`, module: 'Altimmo',
      typeAction: 'MODIFICATION', auteur: buildAuteur(req.user),
      cible: { id: String(reservation._id), type: 'HotelReservation', nom: reservation.reference }, req,
    });
    await notifyGuestRoomEvent(reservation, 'hotel_room_changed', '🔄 Changement de chambre', `Votre chambre a été changée pour la réservation ${reservation.reference}.`);

    res.json({ status: 'success', data: { assignment } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/hotels/room-assignments/release — libérer la chambre
// ─────────────────────────────────────────────
exports.release = async (req, res) => {
  try {
    const { reservationId, reason } = req.body;
    const { error, reservation } = await loadReservationWithAccess(req, reservationId);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Réservation introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que les réservations de vos propres hôtels.");

    const result = await releaseRoom({ reservationId, actingUser: req.user, reason: reason || '' });

    logAction({
      action: 'Chambre libérée', description: `Réservation ${reservation.reference} → chambre libérée`, module: 'Altimmo',
      typeAction: 'MODIFICATION', auteur: buildAuteur(req.user),
      cible: { id: String(reservation._id), type: 'HotelReservation', nom: reservation.reference }, req,
    });

    res.json({ status: 'success', data: { assignment: result.assignment, room: result.room } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};
