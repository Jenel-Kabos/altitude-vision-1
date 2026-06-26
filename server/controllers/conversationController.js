// server/controllers/conversationController.js
const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const User = require('../models/User');

// Gestion optionnelle du modèle Conversation
let Conversation = null;
try {
  Conversation = require('../models/Conversation');
} catch (error) {
  // Le modèle n'existe pas encore, on fera sans (mode basé sur les messages)
}

/**
 * @description Récupérer toutes les conversations de l'utilisateur
 * @route GET /api/conversations
 * @access Protected
 */
exports.getConversations = asyncHandler(async (req, res) => {
  if (Conversation) {
    const conversations = await Conversation.find({
      participants: req.user.id,
      isArchived: { $ne: true },
    })
      .populate('participants', 'name email photo')
      .sort({ updatedAt: -1 });

    // Extraire unreadCount depuis la Map Mongoose pour l'utilisateur courant
    const withUnread = conversations.map((conv) => {
      const obj = conv.toObject();
      obj.unreadCount = conv.unreadCount?.get(req.user.id) || 0;
      return obj;
    });

    return res.status(200).json({
      status: 'success',
      results: withUnread.length,
      data: { conversations: withUnread },
    });
  }

  // Fallback : construire les conversations à partir des messages
  const messages = await Message.find({
    $or: [{ sender: req.user.id }, { receiver: req.user.id }],
  })
    .populate('sender', 'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 });

  const conversationsMap = new Map();

  messages.forEach((message) => {
    const isSender = message.sender._id.toString() === req.user.id;
    const otherUserId = isSender ? message.receiver._id.toString() : message.sender._id.toString();
    const otherUser = isSender ? message.receiver : message.sender;

    if (!conversationsMap.has(otherUserId)) {
      conversationsMap.set(otherUserId, {
        _id: otherUserId,
        user: otherUser,
        lastMessage: message,
        unreadCount: 0,
        updatedAt: message.createdAt,
      });
    }
  });

  for (const [userId, conversation] of conversationsMap.entries()) {
    const unreadCount = await Message.countDocuments({
      sender: userId,
      receiver: req.user.id,
      isRead: false,
    });
    conversation.unreadCount = unreadCount;
  }

  const conversations = Array.from(conversationsMap.values());

  res.status(200).json({
    status: 'success',
    results: conversations.length,
    data: { conversations },
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

  // ✅ CORRECTION : résoudre l'ID de l'autre participant depuis la Conversation
  let otherUserId = conversationId; // valeur par défaut (fallback ancien comportement)

  if (Conversation) {
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      // Trouver l'autre participant (celui qui n'est pas l'utilisateur connecté)
      const otherParticipant = conversation.participants.find(
        (p) => p.toString() !== req.user.id.toString()
      );
      if (otherParticipant) {
        otherUserId = otherParticipant.toString();
      }
    }
  }

  // Maintenant chercher les messages entre req.user.id et otherUserId
  const messages = await Message.find({
    $or: [
      { sender: req.user.id, receiver: otherUserId },
      { sender: otherUserId, receiver: req.user.id },
    ],
  })
    .populate('sender', 'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ createdAt: 1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Message.countDocuments({
    $or: [
      { sender: req.user.id, receiver: otherUserId },
      { sender: otherUserId, receiver: req.user.id },
    ],
  });

  // Marquer les messages reçus comme lus
  await Message.updateMany(
    { sender: otherUserId, receiver: req.user.id, isRead: false },
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