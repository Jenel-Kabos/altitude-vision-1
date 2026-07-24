const mongoose = require('mongoose');
const Hotel = require('../../models/Hotel');
const User = require('../../models/User');
const HotelStaffAssignment = require('../../models/HotelStaffAssignment');
const { HOTEL_ASSIGNMENT_ROLES, ALL_HOTEL_CAPABILITY_VALUES, HOTEL_OPERATIONAL_CAPABILITIES, DEFAULT_CAPABILITIES_BY_ASSIGNMENT_ROLE } = require('../../constants/hotelAccessConstants');
const { resolveHotelAccessScope, effectiveCapabilities } = require('./hotelAccessScopeService');
const { fail } = require('./hotelAccessError');
const { logAction, buildAuteur } = require('../actionLogService');

const id = (value) => String(value?._id || value?.id || value || '');
const RESERVED_ADMIN_CAPABILITY = 'hotel.checkout.financial_override';

// ActionLog.metadata.{ancienneValeur,nouvelleValeur} sont typés String (schema existant, non
// Mixed) : sérialiser en JSON. L'eventType lui-même est porté par `action` (texte libre indexé
// par typeAction/date), pas par metadata, pour rester interrogeable simplement.
async function auditAssignment({ event, actor, assignment, previousState, newState, reason, req, session }) {
  await logAction({
    action: `hotel_staff.${event}`,
    description: reason || `Rattachement ${assignment._id} (${assignment.assignmentRole}) — ${event}`,
    module: 'Hotel',
    typeAction: event.includes('revoked') ? 'SUPPRESSION' : event.includes('created') ? 'CRÉATION' : 'MODIFICATION',
    auteur: buildAuteur(actor),
    cible: { id: String(assignment._id), type: 'HotelStaffAssignment', nom: String(assignment.hotel) },
    metadata: { ancienneValeur: previousState ? JSON.stringify(previousState) : null, nouvelleValeur: newState ? JSON.stringify(newState) : null },
    req,
    session,
  });
}

function assertNoSelfEscalation(actor, targetUserId) {
  if (String(actor._id || actor.id) === String(targetUserId)) fail('HOTEL_ASSIGNMENT_SELF_ESCALATION', 'Un acteur ne peut pas modifier son propre rattachement.', 403);
}

/** Un manager de gestion (non-Admin) ne peut jamais attribuer une capacité qu'il ne possède pas
 * lui-même sur cet hôtel, ni le rôle hotel_manager, ni l'override financier (§18/§19). */
async function assertNoPrivilegeEscalation({ actor, hotelId, assignmentRole, capabilities }) {
  if (actor.role === 'Admin') {
    if (capabilities.includes(RESERVED_ADMIN_CAPABILITY)) fail('HOTEL_ASSIGNMENT_PRIVILEGE_ESCALATION', "La capacité d'override financier ne peut être déléguée en dehors du rôle Admin global.", 403);
    return;
  }
  if (capabilities.includes(RESERVED_ADMIN_CAPABILITY)) fail('HOTEL_ASSIGNMENT_PRIVILEGE_ESCALATION', "Capacité réservée à Admin.", 403);
  if (assignmentRole === 'hotel_manager') {
    const scope = await resolveHotelAccessScope({ actor, requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.STAFF_ASSIGNMENT_MANAGE, requestedHotelId: hotelId }).catch(() => null);
    if (!scope || scope.assignment?.assignmentRole !== 'hotel_manager') fail('HOTEL_ASSIGNMENT_PRIVILEGE_ESCALATION', 'Seul un hotel_manager (ou Admin) peut attribuer le rôle hotel_manager.', 403);
  }
  const scope = await resolveHotelAccessScope({ actor, requiredCapability: HOTEL_OPERATIONAL_CAPABILITIES.STAFF_ASSIGNMENT_MANAGE, requestedHotelId: hotelId });
  const actorCapabilities = new Set(scope.effectiveCapabilities || []);
  const excess = capabilities.filter((cap) => !actorCapabilities.has(cap));
  if (excess.length) fail('HOTEL_ASSIGNMENT_PRIVILEGE_ESCALATION', `Capacités non détenues par l'acteur : ${excess.join(', ')}.`, 403);
}

function validateCapabilities(capabilities = []) {
  const deduped = [...new Set(capabilities)];
  const unknown = deduped.filter((cap) => !ALL_HOTEL_CAPABILITY_VALUES.includes(cap));
  if (unknown.length) fail('HOTEL_ASSIGNMENT_CAPABILITY_INVALID', `Capacités inconnues : ${unknown.join(', ')}.`, 422);
  return deduped;
}

function validatePeriod(validFrom, validUntil) {
  const from = validFrom ? new Date(validFrom) : new Date();
  if (Number.isNaN(from.getTime())) fail('HOTEL_ASSIGNMENT_INVALID_PERIOD', 'validFrom invalide.', 422);
  let until = null;
  if (validUntil) {
    until = new Date(validUntil);
    if (Number.isNaN(until.getTime())) fail('HOTEL_ASSIGNMENT_INVALID_PERIOD', 'validUntil invalide.', 422);
    if (until.getTime() <= from.getTime()) fail('HOTEL_ASSIGNMENT_INVALID_PERIOD', 'validUntil doit être postérieur à validFrom.', 422);
  }
  return { from, until };
}

async function createHotelStaffAssignment({ actor, hotelId, userId, assignmentRole, capabilities = [], validFrom, validUntil, session }) {
  if (!mongoose.isValidObjectId(hotelId)) fail('HOTEL_ACCESS_DENIED', 'Hôtel introuvable.', 404);
  if (!mongoose.isValidObjectId(userId)) fail('HOTEL_ASSIGNMENT_NOT_FOUND', 'Utilisateur introuvable.', 404);
  if (!HOTEL_ASSIGNMENT_ROLES.includes(assignmentRole)) fail('HOTEL_ASSIGNMENT_CAPABILITY_INVALID', 'Rôle local inconnu.', 422);
  assertNoSelfEscalation(actor, userId);

  const dedupedCapabilities = validateCapabilities(capabilities);
  const { from, until } = validatePeriod(validFrom, validUntil);

  const [hotel, user] = await Promise.all([Hotel.findById(hotelId).session(session || null), User.findById(userId).session(session || null)]);
  if (!hotel) fail('HOTEL_ACCESS_DENIED', 'Hôtel introuvable.', 404);
  if (!user) fail('HOTEL_ASSIGNMENT_NOT_FOUND', 'Utilisateur introuvable.', 404);

  await assertNoPrivilegeEscalation({ actor, hotelId, assignmentRole, capabilities: dedupedCapabilities });

  const existingActive = await HotelStaffAssignment.findOne({ user: userId, hotel: hotelId, assignmentRole, status: 'active' }).session(session || null);
  if (existingActive) fail('HOTEL_ASSIGNMENT_ALREADY_ACTIVE', 'Un rattachement actif identique existe déjà.', 409);

  const [assignment] = await HotelStaffAssignment.create([{
    user: userId, hotel: hotelId, assignmentRole, capabilities: dedupedCapabilities, status: 'active',
    validFrom: from, validUntil: until, assignedBy: id(actor), assignedAt: new Date(),
  }], { session });

  await auditAssignment({ event: 'assignment_created', actor, assignment, previousState: null, newState: assignment.toObject() });
  return assignment;
}

async function listHotelStaffAssignments({ hotelId, status, assignmentRole, page = 1, limit = 20 }) {
  const query = { hotel: hotelId };
  if (status) query.status = status;
  if (assignmentRole) query.assignmentRole = assignmentRole;
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const [items, total] = await Promise.all([
    HotelStaffAssignment.find(query).populate('user', 'name email role').sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    HotelStaffAssignment.countDocuments(query),
  ]);
  return { items, total, page: safePage, limit: safeLimit };
}

async function getHotelStaffAssignment(assignmentId) {
  const assignment = await HotelStaffAssignment.findById(assignmentId).populate('user', 'name email role').populate('hotel', 'name brand');
  if (!assignment) fail('HOTEL_ASSIGNMENT_NOT_FOUND', 'Rattachement introuvable.', 404);
  return assignment;
}

async function updateHotelStaffAssignment({ actor, assignmentId, capabilities, validUntil }) {
  const assignment = await HotelStaffAssignment.findById(assignmentId);
  if (!assignment) fail('HOTEL_ASSIGNMENT_NOT_FOUND', 'Rattachement introuvable.', 404);
  if (assignment.status !== 'active') fail('HOTEL_ASSIGNMENT_REVOKED', 'Ce rattachement n’est plus actif.', 409);
  assertNoSelfEscalation(actor, assignment.user);
  const previousState = assignment.toObject();
  if (capabilities) {
    const deduped = validateCapabilities(capabilities);
    await assertNoPrivilegeEscalation({ actor, hotelId: assignment.hotel, assignmentRole: assignment.assignmentRole, capabilities: deduped });
    assignment.capabilities = deduped;
  }
  if (validUntil !== undefined) {
    const { until } = validatePeriod(assignment.validFrom, validUntil);
    assignment.validUntil = until;
  }
  await assignment.save();
  await auditAssignment({ event: 'assignment_updated', actor, assignment, previousState, newState: assignment.toObject() });
  return assignment;
}

async function suspendHotelStaffAssignment({ actor, assignmentId, reason }) {
  const assignment = await HotelStaffAssignment.findById(assignmentId);
  if (!assignment) fail('HOTEL_ASSIGNMENT_NOT_FOUND', 'Rattachement introuvable.', 404);
  assertNoSelfEscalation(actor, assignment.user);
  if (assignment.status === 'suspended') return assignment; // idempotent
  if (assignment.status !== 'active') fail('HOTEL_ASSIGNMENT_REVOKED', 'Seul un rattachement actif peut être suspendu.', 409);
  if (!reason || String(reason).trim().length < 10) fail('HOTEL_ASSIGNMENT_INVALID_PERIOD', 'Une raison d’au moins 10 caractères est obligatoire.', 422);
  const previousState = assignment.toObject();
  assignment.status = 'suspended';
  assignment.suspendedBy = id(actor);
  assignment.suspendedAt = new Date();
  assignment.suspensionReason = String(reason).trim().slice(0, 1000);
  await assignment.save();
  await auditAssignment({ event: 'assignment_suspended', actor, assignment, previousState, newState: assignment.toObject(), reason });
  return assignment;
}

async function reactivateHotelStaffAssignment({ actor, assignmentId }) {
  const assignment = await HotelStaffAssignment.findById(assignmentId);
  if (!assignment) fail('HOTEL_ASSIGNMENT_NOT_FOUND', 'Rattachement introuvable.', 404);
  assertNoSelfEscalation(actor, assignment.user);
  if (assignment.status === 'active') return assignment; // idempotent
  if (assignment.status === 'revoked') fail('HOTEL_ASSIGNMENT_REVOKED', 'Un rattachement révoqué ne peut pas être réactivé.', 409);
  const previousState = assignment.toObject();
  assignment.status = 'active';
  assignment.suspendedBy = null;
  assignment.suspendedAt = null;
  assignment.suspensionReason = null;
  await assignment.save();
  await auditAssignment({ event: 'assignment_reactivated', actor, assignment, previousState, newState: assignment.toObject() });
  return assignment;
}

async function revokeHotelStaffAssignment({ actor, assignmentId, reason }) {
  const assignment = await HotelStaffAssignment.findById(assignmentId);
  if (!assignment) fail('HOTEL_ASSIGNMENT_NOT_FOUND', 'Rattachement introuvable.', 404);
  assertNoSelfEscalation(actor, assignment.user);
  if (assignment.status === 'revoked') return assignment; // idempotent
  if (!reason || String(reason).trim().length < 10) fail('HOTEL_ASSIGNMENT_INVALID_PERIOD', 'Une raison d’au moins 10 caractères est obligatoire.', 422);
  const previousState = assignment.toObject();
  assignment.status = 'revoked';
  assignment.revokedBy = id(actor);
  assignment.revokedAt = new Date();
  assignment.revocationReason = String(reason).trim().slice(0, 1000);
  await assignment.save();
  await auditAssignment({ event: 'assignment_revoked', actor, assignment, previousState, newState: assignment.toObject(), reason });
  return assignment;
}

function publicAssignment(assignment) {
  const now = new Date();
  const effective = assignment.status === 'active' && (!assignment.validFrom || assignment.validFrom <= now) && (!assignment.validUntil || assignment.validUntil > now);
  return {
    id: assignment._id,
    user: assignment.user?._id ? { id: assignment.user._id, name: assignment.user.name, email: assignment.user.email } : { id: assignment.user },
    hotel: assignment.hotel?._id ? { id: assignment.hotel._id, name: assignment.hotel.name } : { id: assignment.hotel },
    assignmentRole: assignment.assignmentRole,
    capabilities: effectiveCapabilities(assignment),
    status: assignment.status,
    effectiveStatus: effective ? 'active' : (assignment.status === 'active' ? (assignment.validFrom > now ? 'pending' : 'expired') : assignment.status),
    validFrom: assignment.validFrom, validUntil: assignment.validUntil,
    assignedAt: assignment.assignedAt, assignedBy: assignment.assignedBy,
    suspendedAt: assignment.suspendedAt, revokedAt: assignment.revokedAt,
  };
}

/**
 * F2.6.3 (volet A) — gouvernance explicite à la création d'un hôtel. Contrairement à
 * `createHotelStaffAssignment`, cette fonction ne fait PAS les contrôles anti-escalade
 * (assertNoSelfEscalation/assertNoPrivilegeEscalation) : accorder au manager désigné d'un
 * hôtel l'accès à SON PROPRE hôtel n'est par construction pas une escalade — c'est
 * exactement ce que `Hotel.manager` legacy accorde déjà sans rattachement explicite.
 * Idempotente : un appel répété (retry) ne crée jamais de doublon (vérifié + protégé par
 * l'index unique partiel du modèle).
 *
 * Accepte et propage un `session` (transaction Mongo) de bout en bout — la lecture de
 * l'existant, la création de l'assignment ET son ActionLog associé (via `auditAssignment`)
 * participent tous à la même transaction quand un `session` est fourni (F2.6.3 — correctif
 * d'atomicité création Hotel + HotelStaffAssignment + ActionLog, voir hotelService.createFullHotel).
 */
async function ensureHotelManagerAssignment({ hotelId, managerId, actor, session, source = 'hotel_creation' }) {
  const existingActive = await HotelStaffAssignment.findOne({ user: managerId, hotel: hotelId, assignmentRole: 'hotel_manager', status: 'active' }).session(session || null);
  if (existingActive) return existingActive;
  const [assignment] = await HotelStaffAssignment.create([{
    user: managerId, hotel: hotelId, assignmentRole: 'hotel_manager', capabilities: [], status: 'active',
    validFrom: new Date(), assignedBy: id(actor), assignedAt: new Date(), metadata: { source },
  }], { session });
  await auditAssignment({ event: 'assignment_created_from_hotel_creation', actor, assignment, previousState: null, newState: assignment.toObject(), session });
  return assignment;
}

/**
 * F2.6.3 (volet A §4.5) — politique de changement de manager, prête et testée mais non
 * câblée à un endpoint HTTP (aucune route ne modifie `Hotel.manager` dans le code actuel —
 * voir documentation §"Changement de manager"). Politique : l'ancien assignment actif
 * `hotel_manager` est révoqué (jamais supprimé) ; un nouvel assignment est créé pour le
 * nouveau manager (jamais de réactivation d'un ancien enregistrement, pour éviter toute
 * ambiguïté sur un historique potentiellement révoqué pour cause).
 */
async function changeHotelManager({ hotel, newManagerId, actor, reason }) {
  const oldManagerId = hotel.manager ? String(hotel.manager) : null;
  const previousState = { manager: oldManagerId };
  hotel.manager = newManagerId;
  await hotel.save();

  if (oldManagerId && oldManagerId !== String(newManagerId)) {
    const oldAssignment = await HotelStaffAssignment.findOne({ user: oldManagerId, hotel: hotel._id, assignmentRole: 'hotel_manager', status: 'active' });
    if (oldAssignment) {
      await revokeHotelStaffAssignment({ actor, assignmentId: oldAssignment._id, reason: reason || 'Remplacement du manager de l’hôtel.' });
    }
  }
  const newAssignment = await ensureHotelManagerAssignment({ hotelId: hotel._id, managerId: newManagerId, actor, source: 'manager_change' });

  await logAction({
    action: 'hotel.manager_changed',
    description: `Hôtel ${hotel._id} : manager ${oldManagerId || '(aucun)'} → ${newManagerId}`,
    module: 'Hotel',
    typeAction: 'MODIFICATION',
    auteur: buildAuteur(actor),
    cible: { id: String(hotel._id), type: 'Hotel' },
    metadata: { ancienneValeur: JSON.stringify(previousState), nouvelleValeur: JSON.stringify({ manager: String(newManagerId) }) },
  });

  return { hotel, newAssignment };
}

module.exports = {
  createHotelStaffAssignment, listHotelStaffAssignments, getHotelStaffAssignment,
  updateHotelStaffAssignment, suspendHotelStaffAssignment, reactivateHotelStaffAssignment, revokeHotelStaffAssignment,
  ensureHotelManagerAssignment, changeHotelManager,
  publicAssignment, validateCapabilities, validatePeriod,
};
