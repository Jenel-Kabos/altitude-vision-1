// server/controllers/conversationController.js
const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

/**
 * @description Récupérer toutes les conversations de l'utilisateur
 * @route GET /api/conversations
 * @access Protected
 */
exports.getConversations = asyncHandler(async (req, res) => {
  // Si vous avez un modèle Conversation
  if (Conversation) {
    const conversations = await Conversation.find({
      participants: req.user.id
    })
      .populate('participants', 'name email avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      status: 'success',
      results: conversations.length,
      data: {
        conversations,
      },
    });
  } else {
    // Sinon, construire les conversations à partir des messages
    const messages = await Message.find({
      $or: [{ sender: req.user.id }, { receiver: req.user.id }],
    })
      .populate('sender', 'name email avatar')
      .populate('receiver', 'name email avatar')
      .sort({ createdAt: -1 });

    const conversationsMap = new Map();

    messages.forEach((message) => {
      const otherUserId =
        message.sender._id.toString() === req.user.id
          ? message.receiver._id.toString()
          : message.sender._id.toString();

      if (!conversationsMap.has(otherUserId)) {
        const otherUser =
          message.sender._id.toString() === req.user.id
            ? message.receiver
            : message.sender;

        conversationsMap.set(otherUserId, {
          _id: otherUserId,
          user: otherUser,
          lastMessage: message,
          unreadCount: 0,
          updatedAt: message.createdAt,
        });
      }
    });

    // Compter les messages non lus pour chaque conversation
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
      data: {
        conversations,
      },
    });
  }
});

/**
 * @description Récupérer les messages d'une conversation spécifique
 * @route GET /api/conversations/:conversationId/messages
 * @access Protected
 */
exports.getConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  // Vérifier que conversationId est un ObjectId valide
  if (!conversationId || !conversationId.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error('ID de conversation invalide.');
  }

  const skip = (page - 1) * limit;

  // Récupérer les messages entre l'utilisateur et l'autre personne
  const messages = await Message.find({
    $or: [
      { sender: req.user.id, receiver: conversationId },
      { sender: conversationId, receiver: req.user.id },
    ],
  })
    .populate('sender', 'name email avatar')
    .populate('receiver', 'name email avatar')
    .sort({ createdAt: 1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Message.countDocuments({
    $or: [
      { sender: req.user.id, receiver: conversationId },
      { sender: conversationId, receiver: req.user.id },
    ],
  });

  // Marquer les messages reçus comme lus
  await Message.updateMany(
    { sender: conversationId, receiver: req.user.id, isRead: false },
    { isRead: true, readAt: Date.now() }
  );

  res.status(200).json({
    status: 'success',
    results: messages.length,
    total,
    totalMessages: total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: {
      messages,
    },
  });
});

/**
 * @description Marquer une conversation comme lue
 * @route PATCH /api/conversations/:conversationId/mark-read
 * @access Protected
 */
exports.markConversationAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  // Vérifier que conversationId est un ObjectId valide
  if (!conversationId || !conversationId.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error('ID de conversation invalide.');
  }

  // Marquer tous les messages de cette conversation comme lus
  const result = await Message.updateMany(
    {
      sender: conversationId,
      receiver: req.user.id,
      isRead: false,
    },
    {
      isRead: true,
      readAt: Date.now(),
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      markedCount: result.modifiedCount,
    },
  });
});

/**
 * @description Créer ou récupérer une conversation
 * @route POST /api/conversations
 * @access Protected
 */
exports.createOrGetConversation = asyncHandler(async (req, res) => {
  // Accepter TOUS les formats possibles pour compatibilité maximale
  const { participantId, userId, otherUserId, receiverId, recipientId } = req.body;
  const targetUserId = participantId || userId || otherUserId || receiverId || recipientId;

  if (!targetUserId) {
    res.status(400);
    throw new Error('ID du participant requis (recipientId, participantId, userId, otherUserId ou receiverId).');
  }

  // Vérifier que le participant existe
  const participant = await User.findById(targetUserId);
  if (!participant) {
    res.status(404);
    throw new Error('Participant non trouvé.');
  }

  // Si vous avez un modèle Conversation
  if (Conversation) {
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user.id, targetUserId] },
    }).populate('participants', 'name email avatar');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user.id, targetUserId],
      });
      await conversation.populate('participants', 'name email avatar');
    }

    res.status(200).json({
      status: 'success',
      data: {
        conversation,
      },
    });
  } else {
    // Sinon, retourner simplement l'ID du participant comme conversationId
    res.status(200).json({
      status: 'success',
      data: {
        conversation: {
          _id: targetUserId,
          participants: [
            { _id: req.user.id, name: req.user.name, email: req.user.email },
            { _id: participant._id, name: participant.name, email: participant.email },
          ],
        },
      },
    });
  }
});

/**
 * @description Supprimer une conversation
 * @route DELETE /api/conversations/:conversationId
 * @access Protected
 */
exports.deleteConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  // Supprimer tous les messages de la conversation
  const result = await Message.deleteMany({
    $or: [
      { sender: req.user.id, receiver: conversationId },
      { sender: conversationId, receiver: req.user.id },
    ],
  });

  console.log(`✅ [deleteConversation] ${result.deletedCount} message(s) supprimé(s)`);

  // Si vous avez un modèle Conversation, le supprimer aussi
  if (Conversation) {
    await Conversation.findByIdAndDelete(conversationId);
  }

  res.status(200).json({
    status: 'success',
    data: {
      deletedCount: result.deletedCount,
    },
  });
});

/**
 * @description Compter les messages non lus dans toutes les conversations
 * @route GET /api/conversations/count/unread
 * @access Protected
 */
exports.countUnreadMessages = asyncHandler(async (req, res) => {
  const unreadCount = await Message.countDocuments({
    receiver: req.user.id,
    isRead: false,
  });

  res.status(200).json({
    status: 'success',
    data: {
      unreadCount,
    },
  });
});