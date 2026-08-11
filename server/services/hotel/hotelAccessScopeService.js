const mongoose = require('mongoose');
const Hotel = require('../../models/Hotel');
const HotelStaffAssignment = require('../../models/HotelStaffAssignment');
const { DEFAULT_CAPABILITIES_BY_ASSIGNMENT_ROLE } = require('../../constants/hotelAccessConstants');
const { fail } = require('./hotelAccessError');
const { assertResourceTenant } = require('../platformTenant/tenantResourceAttributionService');

const id = (value) => String(value?._id || value?.id || value || '');

function effectiveCapabilities(assignment) {
  const defaults = DEFAULT_CAPABILITIES_BY_ASSIGNMENT_ROLE[assignment.assignmentRole] || [];
  return [...new Set([...defaults, ...(assignment.capabilities || [])])];
}

// Un rattachement est effectif maintenant si son statut est 'active' ET que la période
// couvre l'instant présent — même si un job de normalisation des statuts n'est pas encore
// passé (§20 de la mission : le contrôle d'accès raisonne toujours en temps réel).
function isEffectiveNow(assignment, now = new Date()) {
  if (assignment.status !== 'active') return false;
  if (assignment.validFrom && assignment.validFrom.getTime() > now.getTime()) return false;
  if (assignment.validUntil && assignment.validUntil.getTime() <= now.getTime()) return false;
  return true;
}

/**
 * Charge les rattachements actifs de l'utilisateur, plus le legacy Hotel.manager (compatibilité
 * F0-F2.5 : un Hotel.manager conserve un accès complet équivalent à hotel_manager, sans qu'une
 * migration soit un préalable bloquant — voir §21 documentation).
 */
async function loadAccessSources(userId, { session } = {}) {
  const q1 = HotelStaffAssignment.find({ user: userId, status: 'active' });
  const q2 = Hotel.find({ manager: userId }).select('_id');
  if (session) { q1.session(session); q2.session(session); }
  const [assignments, legacyHotels] = await Promise.all([q1.lean(), q2.lean()]);
  const now = new Date();
  const effectiveAssignments = assignments.filter((a) => isEffectiveNow(a, now));
  return { effectiveAssignments, legacyHotels };
}

/**
 * Résout la portée hôtelière effective d'un acteur pour une capacité donnée.
 * Ne modifie aucune donnée. Retourne :
 *   { globalAccess, hotelIds, assignment, effectiveCapabilities }
 */
async function resolveHotelAccessScope({ actor, requiredCapability, requestedHotelId, session } = {}) {
  if (!actor) fail('HOTEL_ACCESS_DENIED', 'Authentification requise.', 401);

  if (actor.role === 'Admin') {
    if (!actor.platformTenant) fail('HOTEL_SCOPE_REQUIRED', 'Contexte tenant requis.', 403);
    if (requestedHotelId) {
      const hotel = await (session ? Hotel.findById(requestedHotelId).session(session) : Hotel.findById(requestedHotelId));
      if (!hotel) fail('HOTEL_ACCESS_DENIED', 'Hôtel introuvable.', 404);
      await assertResourceTenant({ resourceType: 'Hotel', resource: hotel, tenantId: actor.platformTenant._id || actor.platformTenant })
        .catch(() => fail('HOTEL_ACCESS_DENIED', 'Hôtel introuvable.', 404));
      return { globalAccess: false, hotelIds: [String(requestedHotelId)], assignment: null, effectiveCapabilities: null };
    }
    const tenantId = actor.platformTenant._id || actor.platformTenant;
    const candidates = await Hotel.find({ $or: [
      { tenant: tenantId },
      { tenant: null, manager: { $in: actor.tenantScopeUserIds || [id(actor)] } },
      { tenant: null, createdBy: { $in: actor.tenantScopeUserIds || [id(actor)] } },
    ] }).select('tenant manager property createdBy').lean();
    const allowed = [];
    for (const hotel of candidates) {
      try {
        await assertResourceTenant({ resourceType: 'Hotel', resource: hotel, tenantId });
        allowed.push(String(hotel._id));
      } catch {}
    }
    if (allowed.length === 0) fail('HOTEL_SCOPE_REQUIRED', "Aucun hôtel accessible dans ce tenant.", 403);
    if (allowed.length > 1) fail('HOTEL_SCOPE_REQUIRED', 'Plusieurs hôtels accessibles : un hotelId explicite est requis.', 409);
    return { globalAccess: false, hotelIds: allowed, assignment: null, effectiveCapabilities: null };
  }

  const { effectiveAssignments, legacyHotels } = await loadAccessSources(id(actor), { session });

  const byHotel = new Map();
  effectiveAssignments.forEach((assignment) => {
    const capabilities = effectiveCapabilities(assignment);
    if (!requiredCapability || capabilities.includes(requiredCapability)) {
      byHotel.set(String(assignment.hotel), { assignment, capabilities });
    }
  });
  // Legacy Hotel.manager : capacités pleines (assignmentRole hotel_manager) — n'écrase pas
  // un rattachement explicite déjà présent pour le même hôtel.
  legacyHotels.forEach((hotel) => {
    const key = String(hotel._id);
    if (!byHotel.has(key)) {
      const legacyAssignment = { hotel: hotel._id, assignmentRole: 'hotel_manager', capabilities: [], status: 'active', metadata: { legacy: true } };
      const capabilities = effectiveCapabilities(legacyAssignment);
      if (!requiredCapability || capabilities.includes(requiredCapability)) byHotel.set(key, { assignment: legacyAssignment, capabilities });
    }
  });

  const hotelIds = [...byHotel.keys()];

  if (requestedHotelId) {
    const match = byHotel.get(String(requestedHotelId));
    if (!match) fail('HOTEL_ACCESS_DENIED', 'Accès à cet hôtel refusé.', 403);
    return { globalAccess: false, hotelIds, assignment: match.assignment, effectiveCapabilities: match.capabilities };
  }
  if (hotelIds.length === 0) fail('HOTEL_SCOPE_REQUIRED', "Aucun rattachement hôtelier actif pour cet utilisateur.", 403);
  if (hotelIds.length > 1) fail('HOTEL_SCOPE_REQUIRED', 'Plusieurs hôtels accessibles : un hotelId explicite est requis.', 409);
  const only = byHotel.get(hotelIds[0]);
  return { globalAccess: false, hotelIds, assignment: only.assignment, effectiveCapabilities: only.capabilities };
}

/** Vérifie l'accès à un hôtel précis pour une capacité donnée ; lève une erreur sinon. */
async function assertHotelCapability({ actor, requiredCapability, hotelId, session }) {
  if (!hotelId) fail('HOTEL_SCOPE_REQUIRED', 'hotelId requis.', 422);
  if (!mongoose.isValidObjectId(hotelId)) fail('HOTEL_ACCESS_DENIED', 'Hôtel introuvable.', 404);
  return resolveHotelAccessScope({ actor, requiredCapability, requestedHotelId: hotelId, session });
}

/** Liste les hôtels accessibles à l'acteur (pour le sélecteur frontend), sans capacité requise. */
async function listAccessibleHotels(actor) {
  if (actor.role === 'Admin') {
    if (!actor.platformTenant) return { globalAccess: false, hotels: [] };
    const tenantId = actor.platformTenant._id || actor.platformTenant;
    const candidates = await Hotel.find({ $or: [
      { tenant: tenantId },
      { tenant: null, manager: { $in: actor.tenantScopeUserIds || [id(actor)] } },
      { tenant: null, createdBy: { $in: actor.tenantScopeUserIds || [id(actor)] } },
    ] }).select('_id tenant manager property createdBy name brand').sort({ name: 1 }).lean();
    const hotels = [];
    for (const hotel of candidates) {
      try {
        await assertResourceTenant({ resourceType: 'Hotel', resource: hotel, tenantId });
        hotels.push(hotel);
      } catch {}
    }
    return { globalAccess: false, hotels };
  }
  const { effectiveAssignments, legacyHotels } = await loadAccessSources(id(actor));
  const hotelIdSet = new Set([...effectiveAssignments.map((a) => String(a.hotel)), ...legacyHotels.map((h) => String(h._id))]);
  if (hotelIdSet.size === 0) return { globalAccess: false, hotels: [] };
  const hotels = await Hotel.find({ _id: { $in: [...hotelIdSet] } }).select('_id name brand').sort({ name: 1 }).lean();
  return { globalAccess: false, hotels };
}

/**
 * Helper contrôleur (F2.6.1) pour les domaines opérationnels (rooms, housekeeping, inspection,
 * maintenance...) qui dérivent l'hôtel d'une ressource déjà chargée (room.hotel, task.hotel...).
 * Reprend exactement la structure de financialAuthorizationService.assertFinancialScope :
 * Hotel.findById (404 si absent) -> Admin ou Hotel.manager legacy (bypass) -> sinon
 * HotelStaffAssignment actif portant la capacité requise, jamais un simple rôle global.
 * Retourne { error: 404|403 } ou {} (accès autorisé) — ne lève jamais, pour un usage direct
 * dans les contrôleurs existants sans changer leur structure try/catch.
 */
async function assertOperationalHotelAccess({ actor, hotelId, capability }) {
  if (!actor) return { error: 403 };
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) return { error: 404 };
  if (!actor.platformTenant && hotel.manager && String(hotel.manager) === id(actor)) return {};
  if (!actor.platformTenant) return { error: 403 };
  try {
    await assertResourceTenant({ resourceType: 'Hotel', resource: hotel, tenantId: actor.platformTenant._id || actor.platformTenant });
  } catch {
    return { error: 404 };
  }
  if (actor.role === 'Admin' || (hotel.manager && String(hotel.manager) === id(actor))) return {};
  const scope = await resolveHotelAccessScope({ actor, requiredCapability: capability, requestedHotelId: hotelId }).catch(() => null);
  if (!scope) return { error: 403 };
  return {};
}

module.exports = { resolveHotelAccessScope, assertHotelCapability, assertOperationalHotelAccess, listAccessibleHotels, effectiveCapabilities, isEffectiveNow };
