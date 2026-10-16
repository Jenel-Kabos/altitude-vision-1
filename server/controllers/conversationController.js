// server/controllers/conversationController.js
const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const { serializeMessage } = require('../services/messageSerializer');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { ALL_STAFF } = require('../utils/roles');
const { assertResourceTenantOrUnattributed, resolveResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');
const { assertConversationAccess, assertConversationWritable, evaluateConversationWriteState, hasSupportCapability, SUPPORT_READ, SUPPORT_REPLY } = require('../services/messagingAuthorizationService');
const { serializeConversation } = require('../services/conversationSerializer');
const HotelReservation = require('../models/HotelReservation');
const Hotel = require('../models/Hotel');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');

const activeTenantId = (req) => req.platformTenant?._id;
// POST-E2E-1 — un client sans tenant propre voit UNIQUEMENT ses propres
// conversations (toujours combiné à `participants: req.user.id` par les
// appelants ci-dessous) : ce filtre tenant n'a de sens que pour le STAFF
// (qui a toujours un tenant réel), jamais pour un client, pour qui il
// excluait à tort sa propre conversation (bug réel démontré :
// `{tenant: undefined}` ne se comporte PAS comme « tout accepter » ici —
// vérifié par reproduction, la conversation existait bien en base mais
// n'apparaissait dans aucune liste côté client).
//
// HOTFIX-MSG-STAFF-INBOX-1 — `tenant: null` ci-dessous n'admettait
// auparavant une conversation que si un participant figurait dans
// `req.tenantScopeUserIds` (dérivé exclusivement d'`OrgMembership`, voir
// organizationService.js:getScopeUserIds). Un client ordinaire n'a
// STRUCTURELLEMENT jamais d'`OrgMembership` (réservée au staff/exploitants,
// déjà établi POST_E2E1_REPORT.md §9/§12) : toute conversation créée sans
// `propertyId` (chemin « Contacter l'agence » générique, resolveConversationTenantId
// retourne `null` faute de ressource à attribuer) devenait donc invisible
// dans TOUTE staff-inbox, quel que soit le staff — bug réel reproduit
// (HOTFIX_MSG_STAFF_INBOX1_ETAT_INITIAL.md §7). `tenant: null` signifie ici
// « ressource non attribuable à un tenant », même sémantique que
// `assertResourceTenantOrUnattributed` (tenantResourceAttributionService.js) :
// aucune attribution possible = aucune frontière tenant à faire respecter,
// jamais un filtre supprimé globalement. Les conversations réellement
// attribuées (`tenant` non-null, bien fourni) restent strictement isolées
// par tenant, inchangé. `getConversations`/`getMyInbox` restent bornés par
// `participants: req.user.id` dans la même requête — cette relaxation ne
// peut jamais exposer la conversation d'un tiers.
const tenantConversationFilter = (req) => (activeTenantId(req)
  ? { $or: [
      { tenant: activeTenantId(req) },
      { tenant: null },
    ] }
  : {});

// POST-E2E-1 — un client ordinaire (rôle non-staff) n'a structurellement
// AUCUN PlatformTenant propre (OrgMembership réservée au staff/exploitants,
// jamais attribuée à l'inscription normale) : `activeTenantId(req)` vaut
// alors `undefined` en permanence pour cet acteur. La frontière tenant
// (`assertResourceTenant`) n'a de sens QUE pour départager plusieurs tenants
// entre eux (staff d'un tenant A ne doit pas lire les conversations du
// tenant B) — elle n'ajoute AUCUNE protection pour un client, dont l'accès
// est déjà strictement borné par la vérification participant/staff
// ci-dessous (jamais retirée, jamais affaiblie). Sans ce garde, TOUT client
// sans tenant recevait un 404/403 sur sa propre conversation — bug réel
// démontré (POST_E2E1_REPORT.md), pas une hypothèse.
//
// HOTFIX-MSG-STAFF-INBOX-1 — `assertResourceTenant` (strict) exigeait une
// attribution `resolved` exacte, ce qui rejetait aussi bien une conversation
// d'un AUTRE tenant (correct) qu'une conversation NON ATTRIBUABLE du tout
// (`tenant: null`, aucun `propertyId` fourni à la création — cas générique
// « Contacter l'agence », voir HOTFIX_MSG_STAFF_INBOX1_ETAT_INITIAL.md §7) —
// bloquant tout staff qui tentait d'OUVRIR une telle conversation, même
// après correction du listing. `assertResourceTenantOrUnattributed` distingue
// les deux : une ressource `unresolved` n'a aucune frontière tenant à faire
// respecter (rien ne la rattache à un tenant, donc aucune fuite possible) et
// passe sans lever d'erreur ; une ressource `resolved` vers un AUTRE tenant
// continue de lever (isolation cross-tenant inchangée, jamais affaiblie).
//
// HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — `assertConversationAccess`
// vit désormais dans `services/messagingAuthorizationService.js` (import
// ci-dessus), pour être réutilisée telle quelle par
// `messageController.js::getMessages` sans edge controller→controller.
// Comportement strictement inchangé pour les 4 appelants ci-dessous —
// seule sa localisation a changé.

async function keepAttributedConversations(req, conversations) {
  // Même raisonnement que `assertConversationAccess` ci-dessus : sans tenant
  // propre, rien à filtrer ici — les requêtes appelantes restreignent déjà
  // par `participants: req.user.id` (jamais un accès élargi).
  // HOTFIX-MSG-STAFF-INBOX-1 — `assertResourceTenantOrUnattributed` (pas la
  // variante stricte) : une conversation `tenant: null` non attribuable
  // (§7 de l'état initial) doit rester dans le résultat pour le staff,
  // jamais une ressource réellement attribuée à un AUTRE tenant.
  if (!activeTenantId(req)) return conversations;
  const allowed = [];
  for (const conversation of conversations) {
    try {
      await assertResourceTenantOrUnattributed({ resourceType: 'Conversation', resource: conversation, tenantId: activeTenantId(req) });
      allowed.push(conversation);
    } catch {}
  }
  return allowed;
}

async function serializeForActor(req, conversation, extra = {}) {
  const writeState = await evaluateConversationWriteState({ actor: req.user, conversation });
  return { ...serializeConversation(conversation, writeState), ...extra };
}

/**
 * @description Récupérer une conversation par son ID (objet complet peuplé)
 * @route GET /api/conversations/:conversationId
 * @access Protected (participant ou staff)
 */
exports.getConversationById = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  const conversation = await Conversation.findById(conversationId)
    .populate('participants', 'name photo role')
    .populate('relatedProperty', 'title images address')
    .lean();

  if (!conversation) {
    return res.status(404).json({
      status: 'fail',
      message: 'Conversation introuvable',
    });
  }

  await assertConversationAccess(req, conversation);

  res.status(200).json({
    status: 'success',
    data: { conversation: await serializeForActor(req, conversation) },
  });
});

/**
 * @description Récupérer toutes les conversations de l'utilisateur
 * @route GET /api/conversations
 * @access Protected
 */
exports.getConversations = asyncHandler(async (req, res) => {
  const candidates = await Conversation.find({ $and: [tenantConversationFilter(req), {
    participants: req.user.id,
    isArchived: { $ne: true },
    isStaffInbox: false, // les convs staff-inbox sont via GET /staff-inbox
  }] })
    .populate('participants', 'name photo role')
    .sort({ updatedAt: -1 });
  const conversations = await keepAttributedConversations(req, candidates);

  const withUnread = await Promise.all(conversations.map((conv) => serializeForActor(req, conv, {
    unreadCount: conv.unreadCount?.get(req.user.id) || 0,
  })));

  res.status(200).json({
    status: 'success',
    results: withUnread.length,
    data: { conversations: withUnread },
  });
});

/**
 * @description Récupérer les messages d'une conversation spécifique
 * @route GET /api/conversations/:conversationId/messages
 * @access Protected
 */
exports.getConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!conversationId) {
    res.status(400);
    throw new Error('ID de conversation invalide.');
  }

  const skip = (page - 1) * limit;

  // Résoudre la conversation et l'autre participant
  let otherUserId = conversationId;
  const convDoc = await Conversation.findById(conversationId);
  if (convDoc) {
    await assertConversationAccess(req, convDoc);
    const otherParticipant = convDoc.participants.find(
      (p) => p.toString() !== req.user.id.toString()
    );
    if (otherParticipant) {
      otherUserId = otherParticipant.toString();
    }
  } else {
    // POST-E2E-2 — même correctif que ci-dessus : nommer l'erreur pour que
    // errorMiddleware.js honore son `.statusCode` réel (404) au lieu de
    // retomber sur 500.
    const error = new Error('Conversation introuvable');
    error.name = 'ConversationAccessError';
    error.statusCode = 404;
    throw error;
  }

  // Requête prioritaire par conversation._id (couvre staff-inbox + nouveaux messages)
  // Fallback sur sender/receiver pour les messages antérieurs à la migration
  const msgQuery = convDoc
    ? {
        $or: [
          { conversation: convDoc._id },
          {
            conversation: { $exists: false },
            $or: [
              { sender: req.user.id, receiver: otherUserId },
              { sender: otherUserId, receiver: req.user.id },
            ],
          },
        ],
      }
    : {
        $or: [
          { sender: req.user.id, receiver: otherUserId },
          { sender: otherUserId, receiver: req.user.id },
        ],
      };

  const messages = await Message.find(msgQuery)
    .populate('sender', 'name photo')
    .populate('receiver', 'name photo')
    .sort({ createdAt: 1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Message.countDocuments(msgQuery);

  // Marquer les messages reçus comme lus (par conversation si disponible)
  await Message.updateMany(
    convDoc
      ? { conversation: convDoc._id, sender: { $ne: req.user.id }, isRead: false }
      : { sender: otherUserId, receiver: req.user.id, isRead: false },
    { isRead: true, readAt: Date.now() }
  );

  res.status(200).json({
    status: 'success',
    results: messages.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: { messages: messages.map(serializeMessage) },
  });
});

/**
 * @description Marquer une conversation comme lue
 * @route PATCH /api/conversations/:conversationId/mark-read
 * @access Protected
 */
exports.markConversationAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  let otherUserId = conversationId;
  let convDoc = null;

  if (Conversation) {
    convDoc = await Conversation.findById(conversationId);
    if (convDoc) {
      await assertConversationAccess(req, convDoc);
      const otherParticipant = convDoc.participants.find(
        (p) => p.toString() !== req.user.id.toString()
      );
      if (otherParticipant) {
        otherUserId = otherParticipant.toString();
      }
    }
  }

  const result = await Message.updateMany(
    { sender: otherUserId, receiver: req.user.id, isRead: false },
    { isRead: true, readAt: Date.now() }
  );

  // Synchroniser la Map unreadCount sur le doc Conversation
  if (convDoc) {
    await convDoc.resetUnread(req.user.id);
    // Si c'est une conversation staff-inbox,
    // remettre aussi la clé 'staff' à zéro
    if (convDoc.isStaffInbox) {
      await convDoc.resetUnread('staff');
    }
  }

  res.status(200).json({
    status: 'success',
    data: { markedCount: result.modifiedCount },
  });
});

/**
 * @description Créer ou récupérer une conversation
 * @route POST /api/conversations
 * @access Protected
 */
exports.createOrGetConversation = asyncHandler(async (req, res) => {
  const { participantId, userId, otherUserId, receiverId, recipientId } = req.body;
  const targetUserId = participantId || userId || otherUserId || receiverId || recipientId;

  if (!targetUserId) {
    res.status(400);
    throw new Error('ID du participant requis.');
  }

  const participant = await User.findById(targetUserId);
  if (!participant) {
    res.status(404);
    throw new Error('Participant non trouvé.');
  }

  const participantAttribution = await resolveResourceTenant({ resourceType: 'User', resource: participant });
  if (participantAttribution.status !== 'resolved' || String(participantAttribution.tenantId) !== String(activeTenantId(req))) {
    res.status(404);
    throw new Error('Participant non trouvé.');
  }

  if (Conversation) {
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user.id, targetUserId] },
      tenant: activeTenantId(req) || null,
      relatedProperty: req.body.relatedProperty || null,
      relatedDossierType: req.body.dossierType || null,
      relatedDossier: req.body.dossierId || null,
      channelType: 'commercial_direct',
    }).populate('participants', 'name photo role');

    if (!conversation) {
      const candidate = {
        participants: [req.user.id, targetUserId],
        relatedProperty: req.body.relatedProperty || null,
        relatedDossierType: req.body.dossierType || null,
        relatedDossier: req.body.dossierId || null,
        tenant: activeTenantId(req),
        isStaffInbox: false,
      };
      await assertConversationWritable({ actor: req.user, conversation: candidate });
      conversation = await Conversation.create({
        ...candidate,
        channelType: 'commercial_direct',
      });
      await conversation.populate('participants', 'name photo role');
    } else {
      await assertConversationWritable({ actor: req.user, conversation });
    }

    const writeState = await evaluateConversationWriteState({ actor: req.user, conversation });

    return res.status(200).json({
      status: 'success',
      data: { conversation: serializeConversation(conversation, writeState) },
    });
  }

  // Fallback sans modèle Conversation
  res.status(200).json({
    status: 'success',
    data: {
      conversation: {
        _id: targetUserId,
        participants: [
          { _id: req.user.id, name: req.user.name, photo: req.user.photo },
          { _id: participant._id, name: participant.name, photo: participant.photo },
        ],
      },
    },
  });
});

/**
 * @description Supprimer une conversation
 * @route DELETE /api/conversations/:conversationId
 * @access Protected
 */
exports.deleteConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  // ✅ CORRECTION : résoudre l'otherUserId pour supprimer les bons messages
  let otherUserId = conversationId;

  if (Conversation) {
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      await assertConversationAccess(req, conversation);
      // P0 SUPPORT-INBOX — supprimer la conversation d'un prospect est une
      // écriture : réservée au prospect lui-même ou à un agent habilité à
      // répondre.
      const isParticipantActor = conversation.participants.some((p) => p.toString() === req.user.id.toString());
      if (conversation.isStaffInbox && !isParticipantActor && !(await hasSupportCapability(req.user, SUPPORT_REPLY))) {
        return res.status(403).json({ status: 'fail', code: 'SUPPORT_REPLY_CAPABILITY_REQUIRED', message: 'Accès refusé' });
      }
      const otherParticipant = conversation.participants.find(
        (p) => p.toString() !== req.user.id.toString()
      );
      if (otherParticipant) {
        otherUserId = otherParticipant.toString();
      }
    } else {
      return res.status(404).json({ status: 'fail', message: 'Conversation introuvable' });
    }
  }

  const result = await Message.deleteMany({
    $or: [
      { sender: req.user.id, receiver: otherUserId },
      { sender: otherUserId, receiver: req.user.id },
    ],
  });

  if (Conversation) {
    try {
      await Conversation.findOneAndDelete({
        $or: [
          { _id: conversationId },
          { participants: { $all: [req.user.id, conversationId] } }
        ]
      });
    } catch (e) {
      // Ignorer erreur de cast si ID invalide
    }
  }

  res.status(200).json({
    status: 'success',
    data: { deletedCount: result.deletedCount },
  });
});

/**
 * @description Compter les messages non lus (GLOBAL)
 * @route GET /api/conversations/count/unread
 * @access Protected
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  let unreadCount = await Message.countDocuments({
    receiver: req.user.id,
    isRead: false,
    // POST-E2E-1 — même raisonnement que tenantConversationFilter : déjà
    // borné par `receiver: req.user.id`, jamais élargi pour un client.
    ...(activeTenantId(req) ? { tenant: activeTenantId(req) } : {}),
  });

  // Staff : ajoute les conversations de la boîte partagée où un message
  // client attend une réponse (clé Map 'staff') — ces messages ont
  // receiver: null et ne sont donc jamais comptés ci-dessus.
  // P0 SUPPORT-INBOX — la boîte de support n'est comptée que pour un agent
  // Altitude Vision actif (`platform.support.read`), jamais pour le staff
  // d'une organisation.
  if (await hasSupportCapability(req.user, SUPPORT_READ)) {
    const staffInboxUnread = await Conversation.countDocuments({
      isStaffInbox: true,
      isArchived: { $ne: true },
      'unreadCount.staff': { $gt: 0 },
    });
    unreadCount += staffInboxUnread;
  }

  res.status(200).json({
    status: 'success',
    data: { unreadCount },
  });
});

/**
 * @description Créer ou récupérer une conversation avec routage staff/client
 * @route POST /api/conversations/start
 * @access Protected
 *
 * Règles :
 *  - Staff → n'importe qui : conversation 1-à-1 classique (isStaffInbox: false)
 *  - Client/Proprietaire → staff uniquement : boîte partagée (isStaffInbox: true)
 *    Le client ne peut PAS contacter directement un autre client/propriétaire.
 *
 * REMPLACE `createOrGetConversation` (POST /) pour les nouveaux flux.
 * L'ancienne route est conservée pour compatibilité avec le mobile existant.
 */
// POST-E2E-1 — un client (jamais membre d'une organisation) n'a pas de
// tenant propre : le tenant de la conversation doit être déduit de la
// RESSOURCE métier contactée (le bien), jamais de l'appartenance du client
// lui-même (`resolveResourceTenant`, déjà utilisé ailleurs pour exactement
// ce cas — voir tenantResourceAttributionService.js). Le staff garde son
// propre tenant sélectionné (`activeTenantId`), comportement inchangé. Sans
// bien fourni (aucune ressource à attribuer), la conversation reste sans
// tenant (`null`, déjà une valeur valide du schéma) — inchangé, non traité
// ce sprint (hors du chemin mobile réel testé, cf. POST_E2E1_REPORT.md).
async function resolveConversationTenantId(req, propertyId) {
  if (ALL_STAFF.includes(req.user.role)) return activeTenantId(req);
  if (!propertyId) return null;
  const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: propertyId });
  return attribution.status === 'resolved' ? attribution.tenantId : null;
}

async function resolveHotelOperationalContext({ actorId, recipientId, dossierType, dossierId }) {
  if (dossierType !== 'HotelReservation') return null;
  const reservation = await HotelReservation.findOne({ _id: dossierId, status: { $in: ['confirmed', 'checked_in'] } })
    .select('hotel guestUser tenant').lean();
  if (!reservation) return null;
  const parties = new Set([String(actorId), String(recipientId)]);
  if (!reservation.guestUser || !parties.has(String(reservation.guestUser))) return null;
  const staffId = String(actorId) === String(reservation.guestUser) ? recipientId : actorId;
  const hotel = await Hotel.findById(reservation.hotel).select('manager tenant').lean();
  const assigned = await HotelStaffAssignment.exists({ user: staffId, hotel: reservation.hotel, status: 'active', $or: [{ validUntil: null }, { validUntil: { $gt: new Date() } }] });
  if (String(hotel?.manager || '') !== String(staffId) && !assigned) return null;
  return { tenantId: reservation.tenant || hotel?.tenant || null };
}

exports.startConversation = async (req, res) => {
  try {
    const { recipientId, propertyId, dossierType, dossierId, message } = req.body;
    const isSenderStaff = ALL_STAFF.includes(req.user.role);
    const conversationTenantId = await resolveConversationTenantId(req, propertyId);
    let recipient = null;
    if (recipientId) recipient = await User.findById(recipientId).select('role');
    if (recipientId && !recipient) return res.status(404).json({ status: 'fail', message: 'Destinataire introuvable.' });
    const directAuthorizedFlow = Boolean(recipientId && !ALL_STAFF.includes(recipient?.role));
    const hotelOperational = recipientId
      ? await resolveHotelOperationalContext({ actorId: req.user.id, recipientId, dossierType, dossierId })
      : null;

    if (!hotelOperational && !isSenderStaff && directAuthorizedFlow) {
      await assertConversationWritable({ actor: req.user, conversation: { participants: [req.user.id, recipientId], tenant: conversationTenantId, relatedProperty: propertyId, relatedDossierType: dossierType, relatedDossier: dossierId, isStaffInbox: false } });
    }

    // ── Trouver ou créer la conversation ─────────────────────────
    let conversation;

    if (isSenderStaff || directAuthorizedFlow || hotelOperational) {
      // Staff → destinataire précis : conversation 1-à-1
      if (!recipientId) {
        return res.status(400).json({ status: 'fail', message: 'recipientId requis pour le staff.' });
      }
      conversation = await Conversation.findOne({
        participants: { $all: [req.user.id, recipientId] },
        isStaffInbox: false,
        tenant: hotelOperational?.tenantId || conversationTenantId || null,
        relatedProperty: propertyId || null,
        relatedDossierType: dossierType || null,
        relatedDossier: dossierId || null,
        channelType: hotelOperational ? 'hotel_operational' : (directAuthorizedFlow ? 'commercial_direct' : null),
      });
      if (!conversation) {
        const candidate = {
          participants: [req.user.id, recipientId],
          relatedProperty: propertyId || null,
          relatedDossierType: dossierType || null,
          relatedDossier: dossierId || null,
          channelType: hotelOperational ? 'hotel_operational' : (directAuthorizedFlow ? 'commercial_direct' : null),
          isStaffInbox: false,
          tenant: hotelOperational?.tenantId || conversationTenantId,
        };
        await assertConversationWritable({ actor: req.user, conversation: candidate });
        conversation = await Conversation.create(candidate);
      }
    } else {
      // Client/Proprietaire → boîte staff partagée
      // Une seule conversation par (client + bien) pour éviter le doublon
      const query = {
        participants: req.user.id,
        isStaffInbox: true,
      };
      if (propertyId) query.relatedProperty = propertyId;

      conversation = await Conversation.findOne(query);
      if (!conversation) {
        conversation = await Conversation.create({
          participants: [req.user.id],
          relatedProperty: propertyId || null,
          isStaffInbox: true,
          tenant: conversationTenantId,
        });
      }
    }

    // ── Premier message optionnel ─────────────────────────────────
    if (message?.trim()) {
      const { getIO } = require('../socket');
      const { notify, notifySupportAgents } = require('../services/notificationService');

      await assertConversationWritable({ actor: req.user, conversation });
      const newMsg = await Message.create({
        sender: req.user.id,
        receiver: (isSenderStaff || directAuthorizedFlow || hotelOperational) ? recipientId : null,
        conversation: conversation._id,
        content: message.trim(),
        tenant: conversation.tenant || null,
      });

      conversation.lastMessage = message.trim();
      await conversation.save();

      const preview = message.trim().slice(0, 100);

      if (isSenderStaff || directAuthorizedFlow || hotelOperational) {
        // Notifier le destinataire direct (chat UI + cloche/liste + push)
        try { getIO().to(recipientId.toString()).emit('new-message', { conversationId: conversation._id, message: serializeMessage(newMsg) }); } catch {}
        notify({ recipient: recipientId,
          type: 'message_staff',
          title: req.user.name || 'Message',
          body: preview,
          data: { conversationId: conversation._id.toString(), screen: 'Chat' },
        }).catch(() => {});
      } else {
        // P0 SUPPORT-INBOX — seuls les agents de support Altitude Vision
        // actifs sont prévenus (temps réel réautorisé + notification), jamais
        // le staff du tenant propriétaire du bien.
        const { emitSupportInboxEvent } = require('../socket');
        try { emitSupportInboxEvent('new-staff-message', { conversationId: conversation._id, message: serializeMessage(newMsg) }).catch(() => {}); } catch {}
        notifySupportAgents({
          type: 'new_staff_message',
          title: req.user.name || 'Nouveau message client',
          body: preview,
          data: { conversationId: conversation._id.toString(), screen: 'Conversations' },
        }).catch(() => {});
      }
    }

    await conversation.populate('participants', 'name photo role');
    if (conversation.relatedProperty) {
      await conversation.populate('relatedProperty', 'title images');
    }

    const writeState = await evaluateConversationWriteState({ actor: req.user, conversation });
    res.status(200).json({ status: 'success', data: { conversation: serializeConversation(conversation, writeState) } });
  } catch (error) {
    console.error('❌ [startConversation]', error.message);
    res.status(error.statusCode || 500).json({ status: error.statusCode ? 'fail' : 'error', code: error.code, message: error.message });
  }
};

/**
 * @description Ma(mes) conversation(s) staff-inbox — un client/propriétaire ne voit
 * que SA propre conversation avec l'équipe, jamais celles des autres utilisateurs
 * (contrairement à GET /staff-inbox qui liste tout, réservé au staff).
 * @route GET /api/conversations/my-inbox
 * @access Protected
 */
exports.getMyInbox = asyncHandler(async (req, res) => {
  const candidates = await Conversation.find({ $and: [tenantConversationFilter(req), {
    participants: req.user.id,
    isStaffInbox: true,
    isArchived: { $ne: true },
  }] })
    .populate('relatedProperty', 'title images')
    .sort('-updatedAt');
  const conversations = await keepAttributedConversations(req, candidates);

  const withUnread = await Promise.all(conversations.map((conv) => serializeForActor(req, conv, {
    unreadCount: conv.unreadCount?.get(req.user.id) || 0,
  })));

  res.status(200).json({
    status: 'success',
    results: withUnread.length,
    data: { conversations: withUnread },
  });
});

/**
 * @description Boîte partagée du staff — toutes les conversations isStaffInbox
 * @route GET /api/conversations/staff-inbox
 * @access Protected (tout rôle staff — ALL_STAFF)
 */
exports.getStaffInbox = async (req, res) => {
  try {
    // P0 SUPPORT-INBOX — boîte de support Altitude Vision : agents actifs
    // `platform.support.read` uniquement (relus maintenant), tous prospects
    // confondus (provenance tenant ou `tenant: null`). Aucun rôle tenant.
    if (!(await hasSupportCapability(req.user, SUPPORT_READ))) {
      return res.status(403).json({ status: 'fail', code: 'SUPPORT_CAPABILITY_REQUIRED', message: 'Boîte de support réservée aux agents Altitude Vision habilités.' });
    }

    const conversations = await Conversation.find({ isStaffInbox: true, isArchived: { $ne: true } })
      .populate('participants', 'name photo role')
      .populate('relatedProperty', 'title images')
      .sort('-updatedAt');

    const withUnread = await Promise.all(conversations.map((conv) => serializeForActor(req, conv, {
      unreadCount: conv.unreadCount?.get('staff') || 0,
    })));

    res.status(200).json({
      status: 'success',
      results: withUnread.length,
      data: { conversations: withUnread },
    });
  } catch (error) {
    console.error('❌ [getStaffInbox]', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
