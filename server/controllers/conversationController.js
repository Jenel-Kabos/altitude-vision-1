// server/controllers/conversationController.js
const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { ALL_STAFF } = require('../utils/roles');

/**
 * @description Récupérer une conversation par son ID (objet complet peuplé)
 * @route GET /api/conversations/:conversationId
 * @access Protected (participant ou staff)
 */
exports.getConversationById = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  const conversation = await Conversation.findById(conversationId)
    .populate('participants', 'name email photo role')
    .populate('relatedProperty', 'title images address')
    .lean();

  if (!conversation) {
    return res.status(404).json({
      status: 'fail',
      message: 'Conversation introuvable',
    });
  }

  const isStaff = ALL_STAFF.includes(req.user.role);
  const isParticipant = conversation.participants
    .some((p) => p._id.toString() === req.user.id);

  if (!isStaff && !isParticipant) {
    return res.status(403).json({
      status: 'fail',
      message: 'Accès refusé',
    });
  }

  res.status(200).json({
    status: 'success',
    data: { conversation },
  });
});

/**
 * @description Récupérer toutes les conversations de l'utilisateur
 * @route GET /api/conversations
 * @access Protected
 */
exports.getConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({
    participants: req.user.id,
    isArchived: { $ne: true },
    isStaffInbox: false, // les convs staff-inbox sont via GET /staff-inbox
  })
    .populate('participants', 'name email photo role')
    .sort({ updatedAt: -1 });

  const withUnread = conversations.map((conv) => {
    const obj = conv.toObject();
    obj.unreadCount = conv.unreadCount?.get(req.user.id) || 0;
    return obj;
  });

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
    const otherParticipant = convDoc.participants.find(
      (p) => p.toString() !== req.user.id.toString()
    );
    if (otherParticipant) {
      otherUserId = otherParticipant.toString();
    }
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
    .populate('sender', 'name email photo')
    .populate('receiver', 'name email photo')
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
    data: { messages },
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

  if (Conversation) {
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user.id, targetUserId] },
    }).populate('participants', 'name email photo');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user.id, targetUserId],
        relatedProperty: req.body.relatedProperty || null,
      });
      await conversation.populate('participants', 'name email photo');
    } else if (!conversation.relatedProperty && req.body.relatedProperty) {
      conversation.relatedProperty = req.body.relatedProperty;
      await conversation.save();
    }

    return res.status(200).json({
      status: 'success',
      data: { conversation },
    });
  }

  // Fallback sans modèle Conversation
  res.status(200).json({
    status: 'success',
    data: {
      conversation: {
        _id: targetUserId,
        participants: [
          { _id: req.user.id, name: req.user.name, email: req.user.email, photo: req.user.photo },
          { _id: participant._id, name: participant.name, email: participant.email, photo: participant.photo },
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
      const otherParticipant = conversation.participants.find(
        (p) => p.toString() !== req.user.id.toString()
      );
      if (otherParticipant) {
        otherUserId = otherParticipant.toString();
      }
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
  const unreadCount = await Message.countDocuments({
    receiver: req.user.id,
    isRead: false,
  });

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
exports.startConversation = async (req, res) => {
  try {
    const { recipientId, propertyId, message } = req.body;
    const isSenderStaff = ALL_STAFF.includes(req.user.role);

    // ── Blocage client → client ──────────────────────────────────
    if (!isSenderStaff && recipientId) {
      const recipient = await User.findById(recipientId).select('role');
      if (!recipient) {
        return res.status(404).json({ status: 'fail', message: 'Destinataire introuvable.' });
      }
      if (!ALL_STAFF.includes(recipient.role)) {
        return res.status(403).json({
          status: 'fail',
          message: 'Vous ne pouvez contacter que notre équipe.',
        });
      }
    }

    // ── Trouver ou créer la conversation ─────────────────────────
    let conversation;

    if (isSenderStaff) {
      // Staff → destinataire précis : conversation 1-à-1
      if (!recipientId) {
        return res.status(400).json({ status: 'fail', message: 'recipientId requis pour le staff.' });
      }
      conversation = await Conversation.findOne({
        participants: { $all: [req.user.id, recipientId] },
        isStaffInbox: false,
      });
      if (!conversation) {
        conversation = await Conversation.create({
          participants: [req.user.id, recipientId],
          relatedProperty: propertyId || null,
          isStaffInbox: false,
        });
      } else if (propertyId && !conversation.relatedProperty) {
        conversation.relatedProperty = propertyId;
        await conversation.save();
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
        });
      }
    }

    // ── Premier message optionnel ─────────────────────────────────
    if (message?.trim()) {
      const { getIO } = require('../socket');
      const { notify, notifyStaff } = require('../services/notificationService');

      const newMsg = await Message.create({
        sender: req.user.id,
        receiver: isSenderStaff ? recipientId : null,
        conversation: conversation._id,
        content: message.trim(),
      });

      conversation.lastMessage = message.trim();
      await conversation.save();

      const preview = message.trim().slice(0, 100);

      if (isSenderStaff) {
        // Notifier le destinataire direct (chat UI + cloche/liste + push)
        try { getIO().to(recipientId.toString()).emit('new-message', { conversationId: conversation._id, message: newMsg }); } catch {}
        notify(recipientId, {
          type: 'new_message',
          title: req.user.name || 'Message',
          body: preview,
          data: { conversationId: conversation._id.toString(), screen: 'Chat' },
        }).catch(() => {});
      } else {
        // Notifier tout le staff en temps réel (chat UI + cloche/liste + push)
        const staff = await User.find({ role: { $in: ALL_STAFF } }).select('_id');
        for (const s of staff) {
          try { getIO().to(s._id.toString()).emit('new-staff-message', { conversationId: conversation._id, message: newMsg }); } catch {}
        }
        notifyStaff({
          type: 'new_staff_message',
          title: req.user.name || 'Nouveau message client',
          body: preview,
          data: { conversationId: conversation._id.toString(), screen: 'Conversations' },
        }).catch(() => {});
      }
    }

    await conversation.populate('participants', 'name email photo role');
    if (conversation.relatedProperty) {
      await conversation.populate('relatedProperty', 'title images');
    }

    res.status(200).json({ status: 'success', data: { conversation } });
  } catch (error) {
    console.error('❌ [startConversation]', error.message);
    res.status(500).json({ status: 'error', message: error.message });
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
  const conversations = await Conversation.find({
    participants: req.user.id,
    isStaffInbox: true,
    isArchived: { $ne: true },
  })
    .populate('relatedProperty', 'title images')
    .sort('-updatedAt');

  const withUnread = conversations.map((conv) => {
    const obj = conv.toObject();
    obj.unreadCount = conv.unreadCount?.get(req.user.id) || 0;
    return obj;
  });

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
    if (!ALL_STAFF.includes(req.user.role)) {
      return res.status(403).json({ status: 'fail', message: 'Accès réservé au staff.' });
    }

    const conversations = await Conversation.find({ isStaffInbox: true, isArchived: { $ne: true } })
      .populate('participants', 'name email photo role')
      .populate('relatedProperty', 'title images')
      .sort('-updatedAt');

    res.status(200).json({
      status: 'success',
      results: conversations.length,
      data: { conversations },
    });
  } catch (error) {
    console.error('❌ [getStaffInbox]', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
};