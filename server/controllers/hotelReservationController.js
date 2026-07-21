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
const { getAvailability } = require('../services/hotelAvailabilityService');
const {
  createReservation, transitionStatus, updateReservation,
} = require('../services/hotelReservationService');
const { logAction, buildAuteur } = require('../services/actionLogService');

const STAFF_ROLES = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'];

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

async function assertReservationAccess(req, reservation) {
  const isGuest = reservation.guestUser && String(reservation.guestUser) === String(req.user?.id);
  if (isGuest) return { role: 'guest' };
  const hotel = await Hotel.findById(reservation.hotel);
  const isOwner = hotel?.manager && String(hotel.manager) === String(req.user?.id);
  if (isOwner) return { role: 'owner', hotel };
  if (STAFF_ROLES.includes(req.user?.role)) return { role: 'staff', hotel };
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
      roomsCount, adults, children, guest, specialRequests,
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

    res.status(201).json({ status: 'success', data: { reservation } });
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
    res.json({ status: 'success', data: { reservations } });
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
    res.json({ status: 'success', data: { reservation } });
  } catch (error) {
    fail(res, 500, error.message);
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
exports.ownerList = async (req, res) => {
  try {
    const isStaff = STAFF_ROLES.includes(req.user.role);
    const { hotelId, status, search, page = 1, limit = 20 } = req.query;

    const hotelQuery = isStaff ? {} : { manager: req.user.id };
    if (hotelId) hotelQuery._id = hotelId;
    const hotels = await Hotel.find(hotelQuery).select('_id name');
    const hotelIds = hotels.map((h) => h._id);
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
    if (!isOwner && !isStaff) { logDenied(req, 'Création réservation'); return fail(res, 403, "Vous ne pouvez créer une réservation que pour vos propres hôtels."); }

    const {
      roomCategoryId, ratePlanId, checkInDate, checkOutDate,
      roomsCount, adults, children, guest, specialRequests, allowPast,
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

    res.status(201).json({ status: 'success', data: { reservation } });
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
