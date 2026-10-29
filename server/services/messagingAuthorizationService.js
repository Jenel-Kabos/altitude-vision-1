// server/services/messagingAuthorizationService.js
// HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — extraction verbatim de
// `assertConversationAccess` (auparavant définie uniquement dans
// `conversationController.js`, sans export) vers un service partagé, pour
// que `messageController.js::getMessages` puisse la réutiliser sans créer
// un edge controller→controller (catégorie de dette déjà suivie par le
// checker d'architecture canonique). Aucune ligne de logique modifiée par
// rapport à la version originale — voir
// HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_EXISTING_CONTRACT.md pour la
// preuve que ce contrat (isStaff ALL_STAFF, tenant-résolu-ou-non-attribué,
// OU participant réel) est déjà celui utilisé identiquement par 4 fonctions
// indépendantes de `conversationController.js` — jamais une politique
// inventée pour ce hotfix.
const { ALL_STAFF } = require('../utils/roles');
const { assertResourceTenantOrUnattributed } = require('./platformTenant/tenantResourceAttributionService');
const { findActiveAuthorization } = require('./contactAuthorizationService');
const HotelReservation = require('../models/HotelReservation');
const Hotel = require('../models/Hotel');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');

const activeTenantId = (req) => req.platformTenant?._id;
// P0 SUPPORT-INBOX — la boîte de support (`isStaffInbox`) appartient
// exclusivement à Altitude Vision. Seuls y accèdent le prospect participant
// et un PlatformOperator ACTIF détenant la capacité exacte, relue à chaque
// accès (une suspension/révocation prend effet immédiatement). Ni le rôle
// User, ni l'adhésion tenant, ni la provenance `conversation.tenant` (bien
// d'une organisation) n'ouvrent cet accès.
const SUPPORT_READ = 'platform.support.read';
const SUPPORT_REPLY = 'platform.support.reply';
const actorKey = (actor) => actor?._id || actor?.id || actor;

async function hasSupportCapability(actor, capability) {
  const userId = actorKey(actor);
  if (!userId || ![SUPPORT_READ, SUPPORT_REPLY].includes(capability)) return false;
  return Boolean(await PlatformOperator.exists({ user: userId, status: 'active', capabilities: capability }));
}

const isInboxParticipant = (conversation, actor) => (conversation?.participants || []).some((participant) =>
  String(participant?._id || participant) === String(actorKey(actor)));

function supportDenied(code = 'SUPPORT_INBOX_ACCESS_DENIED') {
  const error = new Error('Accès refusé');
  error.name = 'ConversationAccessError';
  error.code = code;
  error.statusCode = 403;
  return error;
}

async function assertSupportInboxAgent(actor, capability = SUPPORT_READ) {
  if (!(await hasSupportCapability(actor, capability))) throw supportDenied('SUPPORT_CAPABILITY_REQUIRED');
}

/**
 * Autorité Messaging canonique sur une conversation précise : tenant résolu
 * (si l'appelant en a un) ET (staff OU participant réel). Lève une erreur
 * nommée `ConversationAccessError` (statusCode 403) si aucune des deux
 * conditions n'est remplie — jamais un accès élargi, jamais une nouvelle
 * condition ajoutée par rapport au comportement historique.
 */
async function assertConversationAccess(req, conversation) {
  if (conversation?.isStaffInbox === true) {
    if (isInboxParticipant(conversation, req.user)) return;
    if (await hasSupportCapability(req.user, SUPPORT_READ)) return;
    throw supportDenied();
  }
  // PLATFORM-ADMIN-04A CLOSURE (H3) — workflow spécialisé `support_inbox` :
  // l'autorité vient de la capability exacte (pas de User.role) et se limite
  // STRICTEMENT aux conversations de l'inbox support ; toute autre
  // conversation (privée, directe) est refusée.
  if (req.platformNativeWorkflow?.workflow === 'support_inbox') {
    if (conversation?.isStaffInbox === true) return;
    const error = new Error('Accès refusé');
    error.name = 'ConversationAccessError';
    error.statusCode = 403;
    throw error;
  }
  if (activeTenantId(req)) {
    await assertResourceTenantOrUnattributed({ resourceType: 'Conversation', resource: conversation, tenantId: activeTenantId(req) });
  }
  const isStaff = ALL_STAFF.includes(req.user.role);
  const isParticipant = (conversation.participants || []).some((participant) =>
    String(participant?._id || participant) === String(req.user.id));
  if (!isStaff && !isParticipant) {
    const error = new Error('Accès refusé');
    error.name = 'ConversationAccessError';
    error.statusCode = 403;
    throw error;
  }
}

const id = (value) => value?._id || value;
const COMMERCIAL_CHANNEL_TYPES = ['commercial_direct', 'hotel_operational'];
const isCommercialConversation = (conversation) => Boolean(
  conversation.relatedProperty || conversation.relatedDossier || conversation.relatedDossierType
  || COMMERCIAL_CHANNEL_TYPES.includes(conversation.channelType),
);
const includesActor = (conversation, actor) => (conversation?.participants || []).some((participant) => String(id(participant)) === String(id(actor)));

async function evaluateConversationWriteState({ actor, conversation, receiverId, propertyId, dossier } = {}) {
  if (!conversation) {
    // GIT-INTEGRATION-03A — nouvelle conversation : commerciale seulement si un
    // contexte métier explicite est fourni (bien, dossier) ; sinon messagerie
    // générale du réseau social, soumise aux règles d'accès existantes.
    if (!receiverId) return { writable: false, code: 'CONVERSATION_REQUIRED', authorizationId: null, channelType: 'unknown' };
    if (propertyId || dossier) return { writable: false, code: 'COMMERCIAL_CONTEXT_REQUIRED', authorizationId: null, channelType: 'commercial_direct' };
    return { writable: true, code: 'GENERAL_CONVERSATION', authorizationId: null, channelType: 'general' };
  }
  if (conversation.isStaffInbox) {
    if (includesActor(conversation, actor)) return { writable: true, code: 'STAFF_INBOX', authorizationId: null, channelType: 'staff_inbox' };
    const writable = await hasSupportCapability(actor, SUPPORT_REPLY);
    return { writable, code: writable ? 'STAFF_INBOX' : 'SUPPORT_REPLY_CAPABILITY_REQUIRED', authorizationId: null, channelType: 'staff_inbox' };
  }
  // Tenant/platform scoping is enforced by assertConversationAccess before
  // this write policy. Preserve legitimate Altitude Vision staff replies.
  const actorIsCommercialOperator = Boolean(await PlatformOperator.exists({
    user: id(actor), status: 'active', capabilities: 'platform.commercial.manage',
  }));
  if (actorIsCommercialOperator) {
    return { writable: true, code: 'STAFF_CONVERSATION', authorizationId: null, channelType: 'staff_conversation' };
  }
  if (!includesActor(conversation, actor)) {
    return { writable: false, code: 'CONVERSATION_PARTICIPANT_REQUIRED', authorizationId: null, channelType: conversation.channelType || 'commercial_direct' };
  }
  if (conversation.channelType === 'hotel_operational' && conversation.relatedDossierType === 'HotelReservation') {
    const reservation = await HotelReservation.findOne({
      _id: id(conversation.relatedDossier),
      status: { $in: ['confirmed', 'checked_in'] },
      ...(conversation.tenant ? { tenant: id(conversation.tenant) } : {}),
    }).select('hotel guestUser status tenant').lean();
    if (!reservation) return { writable: false, code: 'HOTEL_RESERVATION_NOT_OPERATIONAL', authorizationId: null, channelType: 'hotel_operational' };
    const participantIds = new Set((conversation.participants || []).map((participant) => String(id(participant))));
    const guestIsParticipant = reservation.guestUser && participantIds.has(String(reservation.guestUser));
    const hotel = await Hotel.findById(reservation.hotel).select('manager').lean();
    const staffIds = [...participantIds].filter((participantId) => participantId !== String(reservation.guestUser));
    const assignedStaff = staffIds.length ? await HotelStaffAssignment.exists({ user: { $in: staffIds }, hotel: reservation.hotel, status: 'active', $or: [{ validUntil: null }, { validUntil: { $gt: new Date() } }] }) : null;
    const staffIsParticipant = Boolean(hotel?.manager && participantIds.has(String(hotel.manager))) || Boolean(assignedStaff);
    const writable = Boolean(guestIsParticipant && staffIsParticipant);
    return { writable, code: writable ? 'HOTEL_OPERATIONAL_CHANNEL' : 'HOTEL_OPERATIONAL_PARTICIPANTS_REQUIRED', authorizationId: null, channelType: 'hotel_operational' };
  }
  // GIT-INTEGRATION-03A — messagerie générale : une conversation sans lien
  // métier explicite (bien, dossier, canal commercial) reste libre. Le contexte
  // commercial n'est jamais déduit des rôles des participants.
  if (!isCommercialConversation(conversation)) {
    return { writable: true, code: 'GENERAL_CONVERSATION', authorizationId: null, channelType: 'general' };
  }
  const participants = (conversation.participants || []).map(id);
  const participantUsers = await User.find({ _id: { $in: participants } }).select('role').lean();
  const participantOperator = await PlatformOperator.exists({
    user: { $in: participantUsers.map((user) => user._id) },
    status: 'active', capabilities: 'platform.commercial.manage',
  });
  if (participantOperator) {
    return { writable: true, code: 'STAFF_CONVERSATION', authorizationId: null, channelType: 'staff_conversation' };
  }
  if (participants.length !== 2 || !conversation.relatedProperty || !conversation.relatedDossierType || !conversation.relatedDossier) {
    return { writable: false, code: 'CONTACT_AUTHORIZATION_REQUIRED', authorizationId: null, channelType: 'commercial_direct' };
  }
  const base = {
    propertyId: id(conversation.relatedProperty) || propertyId,
    dossierType: conversation.relatedDossierType || dossier?.type,
    dossierId: id(conversation.relatedDossier) || dossier?.id,
    tenantId: id(conversation.tenant) || null,
    scope: 'direct_transactional_messaging',
  };
  let authorization = await findActiveAuthorization({ ...base, clientId: participants[0], representativeId: participants[1] });
  if (!authorization) authorization = await findActiveAuthorization({ ...base, clientId: participants[1], representativeId: participants[0] });
  return {
    writable: Boolean(authorization),
    code: authorization ? 'CONTACT_AUTHORIZATION_ACTIVE' : 'CONTACT_AUTHORIZATION_REQUIRED',
    authorizationId: authorization ? String(authorization._id) : null,
    channelType: 'commercial_direct',
  };
}

async function assertConversationWritable(input) {
  const state = await evaluateConversationWriteState(input);
  if (!state.writable) {
    const error = new Error('Cette conversation est en lecture seule.');
    error.name = 'ConversationAccessError';
    error.code = state.code;
    error.statusCode = 403;
    throw error;
  }
  return state;
}

module.exports = {
  assertConversationAccess, evaluateConversationWriteState, assertConversationWritable,
  hasSupportCapability, assertSupportInboxAgent, isCommercialConversation, SUPPORT_READ, SUPPORT_REPLY,
};
