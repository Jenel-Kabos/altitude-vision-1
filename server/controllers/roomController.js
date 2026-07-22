// server/controllers/roomController.js — Sprint D (opérations hôtelières)
//
// CRUD des chambres physiques. Même convention d'ownership que
// roomCategoryController.js (Sprint B2) : propriétaire de l'hôtel ou staff
// (ROLES_ALTIMMO), jamais un tiers — mission §13 "le propriétaire gère
// uniquement ses hôtels".

const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const Room = require('../models/Room');
const RoomAssignment = require('../models/RoomAssignment');
const { logAction, buildAuteur } = require('../services/actionLogService');

const STAFF_ROLES = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'];

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message });

async function assertHotelAccess(req, hotelId) {
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) return { error: 404 };
  if (String(hotel.manager) !== String(req.user.id) && !STAFF_ROLES.includes(req.user.role)) {
    return { error: 403 };
  }
  return { hotel };
}

// ─────────────────────────────────────────────
// GET /api/hotels/:hotelId/rooms — tableau des chambres (filtres §8)
// ─────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const { error } = await assertHotelAccess(req, req.params.hotelId);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez consulter que vos propres hôtels.");

    const { floor, roomCategoryId, status, active } = req.query;
    const query = { hotel: req.params.hotelId };
    if (floor !== undefined && floor !== '') query.floor = Number(floor);
    if (roomCategoryId) query.roomCategory = roomCategoryId;
    if (status) query.status = status;
    // Correctif : un sélecteur d'affectation (RoomAssignmentPanel) doit
    // pouvoir exclure les chambres désactivées (`active=true`) — le tableau
    // de bord "Chambres", lui, continue de tout afficher par défaut (aucun
    // filtre `active` envoyé) pour permettre la réactivation.
    if (active !== undefined) query.active = active === 'true' || active === true;

    const rooms = await Room.find(query).populate('roomCategory', 'name').sort({ floor: 1, roomNumber: 1 });

    // Réservation/client courants pour chaque chambre occupée/réservée —
    // une seule requête groupée (jamais un N+1 par chambre).
    const roomIds = rooms.map((r) => r._id);
    const assignments = roomIds.length
      ? await RoomAssignment.find({ room: { $in: roomIds }, releasedAt: null })
        .populate({ path: 'reservation', select: 'reference guest status' })
      : [];
    const assignmentByRoom = new Map(assignments.map((a) => [String(a.room), a]));

    const withAssignment = rooms.map((room) => {
      const assignment = assignmentByRoom.get(String(room._id));
      return {
        ...room.toObject(),
        reservation: assignment?.reservation
          ? { _id: assignment.reservation._id, reference: assignment.reservation.reference, guest: assignment.reservation.guest, status: assignment.reservation.status }
          : null,
      };
    });

    res.json({ status: 'success', data: { rooms: withAssignment } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/hotels/:hotelId/rooms
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const { error } = await assertHotelAccess(req, req.params.hotelId);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");

    const { roomCategoryId, roomNumber, floor, wing, notes, features } = req.body;
    if (!roomNumber || !String(roomNumber).trim()) return fail(res, 422, 'Le numéro de chambre est requis.');
    if (!mongoose.isValidObjectId(roomCategoryId)) return fail(res, 422, 'Catégorie de chambres invalide.');
    const category = await RoomCategory.findOne({ _id: roomCategoryId, hotel: req.params.hotelId });
    if (!category) return fail(res, 404, "Catégorie de chambres introuvable pour cet hôtel.");

    let room;
    try {
      room = await Room.create({
        hotel: req.params.hotelId, roomCategory: roomCategoryId, roomNumber,
        floor: floor ?? 0, wing: wing || '', notes: notes || '',
        features: Array.isArray(features) ? features : [],
        createdBy: req.user.id,
      });
    } catch (error) {
      if (error.code === 11000) return fail(res, 409, 'Ce numéro de chambre existe déjà pour cet hôtel.');
      if (error.name === 'ValidationError') return fail(res, 422, error.message);
      throw error;
    }

    logAction({
      action: 'Chambre créée', description: `Chambre ${room.roomNumber} créée`, module: 'Altimmo',
      typeAction: 'CREATION', auteur: buildAuteur(req.user),
      cible: { id: String(room._id), type: 'Room', nom: room.roomNumber }, req,
    });

    res.status(201).json({ status: 'success', data: { room } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/hotels/rooms/:id
// ─────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const room = await Room.findById(req.params.id);
    if (!room) return fail(res, 404, 'Chambre introuvable.');
    const { error } = await assertHotelAccess(req, room.hotel);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");

    const { roomNumber, floor, wing, notes, features, active, roomCategoryId, status } = req.body;
    if (roomNumber !== undefined) room.roomNumber = roomNumber;
    if (floor !== undefined) room.floor = Number(floor);
    if (wing !== undefined) room.wing = wing;
    if (notes !== undefined) room.notes = notes;
    if (features !== undefined) room.features = Array.isArray(features) ? features : room.features;
    if (active !== undefined) room.active = Boolean(active);
    if (roomCategoryId) {
      const category = await RoomCategory.findOne({ _id: roomCategoryId, hotel: room.hotel });
      if (!category) return fail(res, 404, "Catégorie de chambres introuvable pour cet hôtel.");
      room.roomCategory = roomCategoryId;
    }
    if (status) {
      // Contrôle final §7 : une transition de statut manuelle (dashboard)
      // respecte la même table que le cycle automatique (check-in/out).
      const allowed = Room.ROOM_STATUS_TRANSITIONS[room.status] || [];
      if (status !== room.status && !allowed.includes(status)) {
        return fail(res, 409, `Transition de statut invalide : ${room.status} → ${status}.`);
      }
      room.status = status;
    }
    room.updatedBy = req.user.id;

    try {
      await room.save();
    } catch (error) {
      if (error.code === 11000) return fail(res, 409, 'Ce numéro de chambre existe déjà pour cet hôtel.');
      if (error.name === 'ValidationError') return fail(res, 422, error.message);
      throw error;
    }

    res.json({ status: 'success', data: { room } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/hotels/rooms/:id
// ─────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const room = await Room.findById(req.params.id);
    if (!room) return fail(res, 404, 'Chambre introuvable.');
    const { error } = await assertHotelAccess(req, room.hotel);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, "Vous ne pouvez gérer que vos propres hôtels.");

    const activeAssignment = await RoomAssignment.findOne({ room: room._id, releasedAt: null });
    if (activeAssignment) return fail(res, 409, 'Cette chambre est actuellement affectée à une réservation — libérez-la avant de la supprimer.');
    // Garde défensive supplémentaire (correctif) : un statut 'occupied'
    // devrait toujours impliquer une affectation active ci-dessus, mais on
    // ne se fie jamais uniquement à un état dérivable — double vérification
    // directe du statut physique de la chambre.
    if (room.status === 'occupied') return fail(res, 409, 'Cette chambre est occupée — libérez-la avant de la supprimer.');

    // Correctif : une chambre ayant un historique d'affectation (même
    // entièrement libéré) ne doit jamais être supprimée physiquement —
    // l'historique (RoomAssignment.releasedAt renseigné) doit rester
    // consultable indéfiniment. On archive (active=false) au lieu de
    // supprimer. Seule une chambre sans AUCUN historique peut être
    // supprimée physiquement (convention déjà en vigueur avant ce correctif).
    const hasHistory = await RoomAssignment.exists({ room: room._id });
    if (hasHistory) {
      room.active = false;
      room.updatedBy = req.user.id;
      await room.save();
      logAction({
        action: 'Chambre archivée', description: `Chambre ${room.roomNumber} désactivée (historique conservé)`, module: 'Altimmo',
        typeAction: 'MODIFICATION', auteur: buildAuteur(req.user),
        cible: { id: String(room._id), type: 'Room', nom: room.roomNumber }, req,
      });
      return res.json({ status: 'success', data: { room, archived: true } });
    }

    await Room.findByIdAndDelete(room._id);
    res.json({ status: 'success', data: {} });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
