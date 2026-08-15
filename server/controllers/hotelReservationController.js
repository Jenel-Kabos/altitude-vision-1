// server/controllers/hotelReservationController.js — Sprint C
//
// Contrôleurs fins : toute la logique de cycle de vie/tarification/
// inventaire reste dans hotelReservationService.js et
// hotelAvailabilityService.js (mission §7 : "centraliser les transitions
// dans un service, pas dans plusieurs contrôleurs"). Ce fichier ne fait que
// router, vérifier les permissions et journaliser.

const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const HotelReservation = require('../models/HotelReservation');
const RoomAssignment = require('../models/RoomAssignment');
const { getAvailability } = require('../services/hotelAvailabilityService');
const {
  createReservation, transitionStatus, updateReservation,
} = require('../services/hotelReservationService');
const { performCheckIn } = require('../services/checkInService');
const { performCheckOut } = require('../services/checkOutService');
const { getActiveAssignments } = require('../services/roomAssignmentService');
const { evaluateHotelCheckoutFinancialReadiness } = require('../services/finance/hotelCheckoutFinancialReadinessService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { resolveHotelAccessScope, listAccessibleHotels } = require('../services/hotel/hotelAccessScopeService');
const { HOTEL_OPERATIONAL_CAPABILITIES } = require('../constants/hotelAccessConstants');

/**
 * N'attache le numéro de chambre QUE pour les réservations checked_in
 * (mission §11 : "le client ne voit jamais son numéro de chambre avant le
 * check-in") — jamais pour une chambre pré-affectée avant l'arrivée.
 */
async function attachRoomNumberIfCheckedIn(reservations) {
  const checkedInIds = reservations.filter((r) => r.status === 'checked_in').map((r) => r._id);
  if (checkedInIds.length === 0) return reservations;
  const assignments = await RoomAssignment.find({ reservation: { $in: checkedInIds }, releasedAt: null })
    .populate('room', 'roomNumber');
  const roomByReservation = new Map(assignments.map((a) => [String(a.reservation), a.room]));
  return reservations.map((r) => {
    const obj = r.toObject ? r.toObject() : r;
    if (r.status === 'checked_in' && roomByReservation.has(String(r._id))) {
      obj.room = { roomNumber: roomByReservation.get(String(r._id))?.roomNumber };
    }
    return obj;
  });
}

const fail = (res, statusCode, message, extra = {}) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message, ...extra });

/** Journalise un accès refusé (mission §19) — jamais de données personnelles dans la description. */
function logDenied(req, action) {
  logAction({
    action: 'Accès refusé — réservation hôtelière',
    description: `${action} refusé pour ${req.user?.role || 'anonyme'}`,
    module: 'Altimmo',
    typeAction: 'REJET',
    auteur: buildAuteur(req.user || {}),
    cible: { id: String(req.params.id || req.params.hotelId || ''), type: 'HotelReservation' },
    req,
  });
}

/**
 * Projection minimale de l'affectation active — jamais `assignedBy`, jamais
 * `reason`, jamais `notes` de la chambre (mission §8, correctif : "ne jamais
 * exposer inutilement des données internes").
 */
function projectRoomAssignment(assignment) {
  if (!assignment) return null;
  return {
    id: assignment._id,
    room: {
      id: assignment.room._id,
      roomNumber: assignment.room.roomNumber,
      floor: assignment.room.floor,
      status: assignment.room.status,
      roomCategory: assignment.room.roomCategory,
    },
    assignedAt: assignment.assignedAt,
  };
}

// F2.6 : un rôle staff (Collaborateur/GestionnaireImmobilier/CommunityManager) n'accorde plus
// automatiquement l'accès à TOUTE réservation de TOUT hôtel — l'accès dérive de l'hôtel réel de
// la réservation persistée, via le scope central (Hotel.manager legacy ou HotelStaffAssignment actif).
async function assertReservationAccess(req, reservation) {
  const isGuest = reservation.guestUser && String(reservation.guestUser) === String(req.user?.id);
  if (isGuest) return { role: 'guest' };
  const hotel = await Hotel.findById(reservation.hotel);
  if (!hotel) return null;
  const isOwner = hotel.manager && String(hotel.manager) === String(req.user?.id);
  if (isOwner) return { role: 'owner', hotel };
  // `hotelReservationRoutes.js` n'attache pas `requireTenantScope` (contrairement à
  // financialRoutes.js) : `req.user.platformTenant` n'est jamais peuplé ici. Sans ce
  // repli sur `req.platformTenant` (résolu par `attachTenantContext`, non bloquant),
  // `resolveHotelAccessScope` échoue systématiquement pour tout acteur Admin/staff qui
  // n'est pas legacy `hotel.manager` — bug réel démontré : un Admin plateforme recevait
  // un 403 permanent sur /room-assignment et /checkout-financial-readiness alors même
  // que les routes financières équivalentes (qui, elles, montent requireTenantScope)
  // lui étaient accessibles.
  // Mutation directe (jamais un spread `{...req.user}` : `req.user` est un
  // document Mongoose, son spread perd `.role`/`.id`, qui ne sont pas des
  // propriétés propres énumérables — bug constaté en le faisant une première
  // fois : `actor.role` devenait `undefined`, faisant tomber la résolution
  // dans la branche non-Admin de `resolveHotelAccessScope`, qui castait
  // ensuite l'acteur entier en ObjectId et échouait). Même pattern que
  // `requireTenantScope` (middleware/tenantContext.js) : `req.user.platformTenant = req.platformTenant`.
  if (!req.user.platformTenant && req.platformTenant) req.user.platformTenant = req.platformTenant;
  const scope = await resolveHotelAccessScope({ actor: req.user, requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.RESERVATION_VIEW, requestedHotelId: reservation.hotel }).catch(() => null);
  if (scope) return { role: 'staff', hotel };
  return null;
}

// ─────────────────────────────────────────────
// Public — GET /api/hotels/:hotelId/availability (avant auth.protect)
// ─────────────────────────────────────────────
exports.getPublicAvailability = async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!mongoose.isValidObjectId(hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const { roomCategoryId, checkInDate, checkOutDate, roomsCount } = req.query;
    if (!mongoose.isValidObjectId(roomCategoryId)) return fail(res, 422, 'Catégorie de chambres invalide.');

    const hotel = await Hotel.findById(hotelId);
    if (!hotel || hotel.publicationStatus !== 'publie' || hotel.active === false) {
      return fail(res, 404, 'Hôtel introuvable.');
    }
    const category = await RoomCategory.findOne({ _id: roomCategoryId, hotel: hotelId, status: 'actif' });
    if (!category) return fail(res, 404, 'Catégorie de chambres introuvable.');

    const result = await getAvailability({
      roomCategoryId, checkInDate, checkOutDate, roomsCount: Number(roomsCount) || 1,
    });
    // Jamais de champ interne (totalUnits exact, blockedUnits...) exposé au
    // public — uniquement ce qui sert à afficher "disponible / non disponible".
    res.json({
      status: 'success',
      data: {
        available: result.available,
        nights: result.nights.map((n) => ({ date: n.date, available: n.sufficient })),
      },
    });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// Public — POST /api/hotels/:hotelId/reservations (auth.optionalAuth)
// ─────────────────────────────────────────────
exports.createPublicReservation = async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!mongoose.isValidObjectId(hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(hotelId);
    if (!hotel || hotel.publicationStatus !== 'publie' || hotel.active === false) {
      return fail(res, 404, 'Hôtel introuvable.');
    }

    const {
      roomCategoryId, ratePlanId, checkInDate, checkOutDate,
      roomsCount, adults, children, guest, specialRequests, reservationRequestId,
    } = req.body;
    if (!guest?.firstName || !guest?.lastName || !guest?.email) {
      return fail(res, 422, 'Prénom, nom et email du client sont requis.');
    }

    const reservation = await createReservation({
      hotelId, roomCategoryId, ratePlanId, guest,
      guestUserId: req.user?.id || null,
      checkInDate, checkOutDate,
      roomsCount: Number(roomsCount) || 1,
      adults: Number(adults) || 1,
      children: Number(children) || 0,
      specialRequests,
      reservationRequestId,
      source: 'public_web',
      actingUser: req.user || {},
    });

    logAction({
      action: 'Réservation hôtelière créée',
      description: `Demande ${reservation.reference} pour "${hotel.name}"`,
      module: 'Altimmo',
      typeAction: 'CREATION',
      auteur: buildAuteur(req.user || { id: null, role: 'Visiteur' }),
      cible: { id: String(reservation._id), type: 'HotelReservation', nom: reservation.reference },
      req,
    });

    const idempotent = Boolean(reservation.$locals?.idempotent);
    res.status(idempotent ? 200 : 201).json({ status: 'success', data: { reservation, idempotent } });
  } catch (error) {
    if (error.statusCode === 409) {
      logAction({
        action: 'Tentative de surbooking bloquée',
        description: `Hôtel ${req.params.hotelId} — dates indisponibles refusées`,
        module: 'Altimmo',
        typeAction: 'REJET',
        auteur: buildAuteur(req.user || { id: null, role: 'Visiteur' }),
        cible: { id: String(req.params.hotelId), type: 'Hotel' },
        req,
      });
      return fail(res, 409, error.message, { unavailableDates: error.unavailableDates });
    }
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// Client connecté
// ─────────────────────────────────────────────
exports.mine = async (req, res) => {
  try {
    const reservations = await HotelReservation.find({ guestUser: req.user.id })
      .populate('hotel', 'name')
      .populate('roomCategory', 'name')
      .sort({ createdAt: -1 });
    res.json({ status: 'success', data: { reservations: await attachRoomNumberIfCheckedIn(reservations) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

exports.getOne = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const reservation = await HotelReservation.findById(req.params.id)
      .populate('hotel', 'name manager')
      .populate('roomCategory', 'name');
    if (!reservation) return fail(res, 404, 'Réservation introuvable.');
    const access = await assertReservationAccess(req, reservation);
    if (!access) { logDenied(req, 'Lecture réservation'); return fail(res, 403, 'Accès refusé.'); }
    const [withRoom] = await attachRoomNumberIfCheckedIn([reservation]);
    res.json({ status: 'success', data: { reservation: withRoom } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// Correctif Sprint D — GET /:id/room-assignment : récupération PERSISTANTE
// de l'affectation active (Option A du correctif). Corrige l'anomalie
// identifiée à l'audit : RoomAssignmentPanel.jsx n'affichait la chambre
// affectée qu'après une action effectuée dans la session React en cours,
// jamais après un rechargement — aucun endpoint de lecture n'existait.
// ─────────────────────────────────────────────
exports.getRoomAssignment = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const reservation = await HotelReservation.findById(req.params.id);
    if (!reservation) return fail(res, 404, 'Réservation introuvable.');
    const access = await assertReservationAccess(req, reservation);
    if (!access) { logDenied(req, 'Lecture affectation de chambre'); return fail(res, 403, 'Accès refusé.'); }

    // Mission §11/§13 (inchangée) : le client ne reçoit jamais le numéro de
    // chambre avant le check-in — même via cet endpoint dédié.
    if (access.role === 'guest' && reservation.status !== 'checked_in') {
      return res.json({ status: 'success', data: { activeRoomAssignment: null } });
    }

    let assignments = await getActiveAssignments(reservation._id);
    if (!Array.isArray(assignments)) {
      const assignment = await require('../services/roomAssignmentService').getActiveAssignment(reservation._id);
      assignments = assignment ? [assignment] : [];
    }
    const projected = assignments.map(projectRoomAssignment);
    const assignmentState = projected.length === 0 ? 'unassigned' : projected.length < reservation.roomsCount ? 'partially_assigned' : 'fully_assigned';
    res.json({ status: 'success', data: { activeRoomAssignment: projected[0] || null, activeRoomAssignments: projected, assignmentState } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.cancel = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const reservation = await HotelReservation.findById(req.params.id);
    if (!reservation) return fail(res, 404, 'Réservation introuvable.');
    const access = await assertReservationAccess(req, reservation);
    if (!access) { logDenied(req, 'Annulation réservation'); return fail(res, 403, 'Accès refusé.'); }

    const updated = await transitionStatus(reservation, {
      to: 'cancelled', actingUser: req.user, reason: req.body?.reason || '',
    });

    logAction({
      action: 'Réservation hôtelière annulée',
      description: `${updated.reference} annulée par ${access.role}`,
      module: 'Altimmo',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(updated._id), type: 'HotelReservation', nom: updated.reference },
      req,
    });

    res.json({ status: 'success', data: { reservation: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// Propriétaire — "Mes réservations" (staff peut aussi créer/gérer, voir
// mission §8 "Administration" : même contrat, ownership élargie au staff)
// ─────────────────────────────────────────────
const STAFF_ROLES = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'];

exports.ownerList = async (req, res) => {
  try {
    const { hotelId, status, search, page = 1, limit = 20 } = req.query;

    // F2.6 : un rôle staff ne voit plus automatiquement TOUS les hôtels (faille corrigée) — la
    // liste vient du scope central (Admin -> tous, sinon rattachements HotelStaffAssignment actifs
    // + Hotel.manager legacy). Le chemin Proprietaire reste inchangé (hotel.manager===lui, F0-F2.5).
    let hotelIds;
    if (STAFF_ROLES.includes(req.user.role)) {
      const { globalAccess, hotels: accessibleHotels } = await listAccessibleHotels(req.user);
      hotelIds = accessibleHotels.map((h) => h._id);
      if (hotelId) {
        const allowed = globalAccess || hotelIds.some((allowedId) => String(allowedId) === String(hotelId));
        if (!allowed) { logDenied(req, 'Liste réservations'); return fail(res, 403, 'Accès refusé.'); }
        hotelIds = [hotelId];
      }
    } else {
      const hotelQuery = { manager: req.user.id };
      if (hotelId) hotelQuery._id = hotelId;
      const hotels = await Hotel.find(hotelQuery).select('_id name');
      hotelIds = hotels.map((h) => h._id);
    }
    if (hotelIds.length === 0) return res.json({ status: 'success', data: { reservations: [], total: 0, page: Number(page), limit: Number(limit) } });

    const query = { hotel: { $in: hotelIds } };
    if (status) query.status = status;
    if (search) query.reference = new RegExp(search, 'i');

    const total = await HotelReservation.countDocuments(query);
    const reservations = await HotelReservation.find(query)
      .populate('hotel', 'name')
      .populate('roomCategory', 'name')
      .sort({ createdAt: -1 })
      .skip((Math.max(1, Number(page)) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ status: 'success', data: { reservations, total, page: Number(page), limit: Number(limit) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

exports.ownerCreate = async (req, res) => {
  try {
    const { hotelId } = req.body;
    if (!mongoose.isValidObjectId(hotelId)) return fail(res, 422, 'Hôtel invalide.');
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');
    const isStaff = STAFF_ROLES.includes(req.user.role);
    const isOwner = hotel.manager && String(hotel.manager) === String(req.user.id);
    const scope = isOwner ? true : await resolveHotelAccessScope({ actor: req.user, requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.RESERVATION_CREATE, requestedHotelId: hotelId }).catch(() => null);
    if (!isOwner && !scope) { logDenied(req, 'Création réservation'); return fail(res, 403, "Vous ne pouvez créer une réservation que pour vos propres hôtels."); }

    const {
      roomCategoryId, ratePlanId, checkInDate, checkOutDate,
      roomsCount, adults, children, guest, specialRequests, allowPast, reservationRequestId,
    } = req.body;
    if (!guest?.firstName || !guest?.lastName || !guest?.email) {
      return fail(res, 422, 'Prénom, nom et email du client sont requis.');
    }

    const reservation = await createReservation({
      hotelId, roomCategoryId, ratePlanId, guest,
      guestUserId: null,
      checkInDate, checkOutDate,
      roomsCount: Number(roomsCount) || 1,
      adults: Number(adults) || 1,
      children: Number(children) || 0,
      specialRequests,
      reservationRequestId,
      source: isStaff && !isOwner ? 'admin_dashboard' : 'owner_dashboard',
      actingUser: req.user,
      // Privilège admin explicite (mission §4) — jamais activé pour un
      // propriétaire, uniquement pour le staff, et seulement s'il le demande.
      allowPast: isStaff && Boolean(allowPast),
    });

    logAction({
      action: 'Réservation hôtelière créée (manuelle)',
      description: `${reservation.reference} créée pour "${hotel.name}"`,
      module: 'Altimmo',
      typeAction: 'CREATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(reservation._id), type: 'HotelReservation', nom: reservation.reference },
      req,
    });

    const idempotent = Boolean(reservation.$locals?.idempotent);
    res.status(idempotent ? 200 : 201).json({ status: 'success', data: { reservation, idempotent } });
  } catch (error) {
    if (error.statusCode === 409) return fail(res, 409, error.message, { unavailableDates: error.unavailableDates });
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const reservation = await HotelReservation.findById(req.params.id);
    if (!reservation) return fail(res, 404, 'Réservation introuvable.');
    const access = await assertReservationAccess(req, reservation);
    if (!access || access.role === 'guest') { logDenied(req, 'Modification réservation'); return fail(res, 403, 'Accès refusé.'); }

    const { checkInDate, checkOutDate, roomCategoryId, ratePlanId, roomsCount, adults, children, specialRequests } = req.body;
    const updated = await updateReservation(reservation, {
      checkInDate, checkOutDate, roomCategoryId, ratePlanId, roomsCount, adults, children, specialRequests,
    }, req.user);

    logAction({
      action: 'Réservation hôtelière modifiée',
      description: `${updated.reference} modifiée par ${access.role}`,
      module: 'Altimmo',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(updated._id), type: 'HotelReservation', nom: updated.reference },
      req,
    });

    res.json({ status: 'success', data: { reservation: updated } });
  } catch (error) {
    if (error.statusCode === 409 && error.unavailableDates) return fail(res, 409, error.message, { unavailableDates: error.unavailableDates });
    fail(res, error.statusCode || 500, error.message);
  }
};

async function reviewAction(req, res, targetStatus, requireReason) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const reservation = await HotelReservation.findById(req.params.id);
    if (!reservation) return fail(res, 404, 'Réservation introuvable.');
    const access = await assertReservationAccess(req, reservation);
    if (!access || access.role === 'guest') { logDenied(req, `Décision ${targetStatus}`); return fail(res, 403, 'Accès refusé.'); }
    if (requireReason && !String(req.body?.reason || '').trim()) return fail(res, 422, 'Un motif est requis.');

    const updated = await transitionStatus(reservation, { to: targetStatus, actingUser: req.user, reason: req.body?.reason || '' });

    logAction({
      action: `Réservation hôtelière ${targetStatus}`,
      description: `${updated.reference} → ${targetStatus} par ${access.role}`,
      module: 'Altimmo',
      typeAction: targetStatus === 'confirmed' ? 'VALIDATION' : 'REJET',
      auteur: buildAuteur(req.user),
      cible: { id: String(updated._id), type: 'HotelReservation', nom: updated.reference },
      req,
    });

    res.json({ status: 'success', data: { reservation: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
}

exports.confirm = (req, res) => reviewAction(req, res, 'confirmed', false);
exports.reject = (req, res) => reviewAction(req, res, 'rejected', true);

// ─────────────────────────────────────────────
// Sprint D — check-in / check-out (jamais accessible au client, mission §13
// : le client ne choisit jamais sa chambre ni ne déclenche lui-même ces
// opérations — réservé propriétaire/staff, comme confirm/reject).
// ─────────────────────────────────────────────
exports.checkIn = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const reservation = await HotelReservation.findById(req.params.id);
    if (!reservation) return fail(res, 404, 'Réservation introuvable.');
    const access = await assertReservationAccess(req, reservation);
    if (!access || access.role === 'guest') { logDenied(req, 'Check-in'); return fail(res, 403, 'Accès refusé.'); }

    const { roomId, roomIds, autoAssign, reason } = req.body;
    const result = await performCheckIn({ reservation, roomId, roomIds, autoAssign: Boolean(autoAssign), actingUser: req.user, reason: reason || '', transactionMode: 'auto' });

    logAction({
      action: 'Check-in effectué', description: `${result.reservation.reference} — check-in (${(result.rooms || (result.room ? [result.room] : [])).length} chambre(s))`, module: 'Altimmo',
      typeAction: 'MODIFICATION', auteur: buildAuteur(req.user),
      cible: { id: String(result.reservation._id), type: 'HotelReservation', nom: result.reservation.reference }, req,
    });

    const rooms = result.rooms || (result.room ? [result.room] : []);
    res.json({ status: 'success', data: { reservation: result.reservation, rooms, room: result.room || rooms[0] || null, financialDocument: result.financialDocument } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.checkOut = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const reservation = await HotelReservation.findById(req.params.id);
    if (!reservation) return fail(res, 404, 'Réservation introuvable.');
    const access = await assertReservationAccess(req, reservation);
    if (!access || access.role === 'guest') { logDenied(req, 'Check-out'); return fail(res, 403, 'Accès refusé.'); }

    const result = await performCheckOut({ reservationId: reservation._id, actingUser: req.user, reason: req.body?.reason || '', financialOverride: req.body?.financialOverride, transactionMode: 'auto' });

    logAction({
      action: 'Check-out effectué', description: `${result.reservation.reference} — check-out`, module: 'Altimmo',
      typeAction: 'MODIFICATION', auteur: buildAuteur(req.user),
      cible: { id: String(result.reservation._id), type: 'HotelReservation', nom: result.reservation.reference }, req,
    });

    res.json({ status: 'success', data: { reservation: result.reservation, rooms: result.rooms, room: result.room, financialCheckout: result.financialCheckout } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message, { ...(error.code ? { code: error.code } : {}), ...(error.financialReadiness ? { financialReadiness: error.financialReadiness } : {}) });
  }
};

exports.checkoutFinancialReadiness = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Identifiant invalide.');
    const reservation = await HotelReservation.findById(req.params.id);
    if (!reservation) return fail(res, 404, 'Réservation introuvable.');
    const access = await assertReservationAccess(req, reservation);
    if (!access || access.role === 'guest') return fail(res, 403, 'Accès refusé.');
    const readiness = await evaluateHotelCheckoutFinancialReadiness({ reservationId: reservation._id, actor: req.user, requestedHotelId: reservation.hotel });
    res.json({ status: 'success', data: { financialReadiness: readiness } });
  } catch (error) { fail(res, error.statusCode || 500, error.message, error.code ? { code: error.code } : {}); }
};

// ─────────────────────────────────────────────
// Administration
// ─────────────────────────────────────────────
exports.listAdmin = async (req, res) => {
  try {
    const { hotelId, status, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (hotelId) query.hotel = hotelId;
    if (status) query.status = status;
    if (search) query.reference = new RegExp(search, 'i');

    const total = await HotelReservation.countDocuments(query);
    const reservations = await HotelReservation.find(query)
      .populate('hotel', 'name manager')
      .populate('roomCategory', 'name')
      .sort({ createdAt: -1 })
      .skip((Math.max(1, Number(page)) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ status: 'success', data: { reservations, total, page: Number(page), limit: Number(limit) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

exports.pending = async (req, res) => {
  try {
    const reservations = await HotelReservation.find({ status: 'pending' })
      .populate('hotel', 'name manager')
      .populate('roomCategory', 'name')
      .sort({ createdAt: 1 });
    res.json({ status: 'success', data: { reservations } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
