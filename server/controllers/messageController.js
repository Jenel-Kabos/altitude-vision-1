// server/controllers/messageController.js
// ⚠️ CE CONTRÔLEUR EST POUR LES CONVERSATIONS EN TEMPS RÉEL UNIQUEMENT
// Pour les emails internes, utilisez internalMailController.js

const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { cleanupUploadedFiles } = require('../middleware/uploadMiddleware');
const { getIO, isUserOnline } = require('../socket');
const { sendExpoPushNotification } = require('../utils/expoPush');

/**
 * @description Envoyer un message dans une conversation
 * @route POST /api/messages
 * @access Protected
 */
exports.sendMessage = asyncHandler(async (req, res) => {
    const { conversationId, receiverId, content } = req.body;
    const uploadedFiles = req.files || [];

    // --- 1. Validation ---
    if (!content || (!conversationId && !receiverId)) {
        cleanupUploadedFiles(uploadedFiles);
        res.status(400);
        throw new Error('Le contenu et soit conversationId ou receiverId sont requis.');
    }

    const attachmentsData = uploadedFiles.map(file => ({
        filename: file.originalname,
        filepath: file.path,
        mimetype: file.mimetype,
        size: file.size
    }));

    let targetUserId = null;
    let convDoc = null;
    let isStaffInbox = false;

    if (receiverId) {
        // CAS 1 : receiverId fourni directement (conv 1-à-1)
        targetUserId = receiverId;
    } else if (conversationId) {
        convDoc = await Conversation.findById(conversationId);
        if (!convDoc) {
            cleanupUploadedFiles(uploadedFiles);
            res.status(404);
            throw new Error('Conversation non trouvée.');
        }

        if (convDoc.isStaffInbox) {
            // CAS 2 : boîte partagée staff
            isStaffInbox = true;
            const senderIsClient = convDoc.participants.some(
                (p) => p.toString() === req.user.id.toString()
            );
            if (senderIsClient) {
                // Client → staff : pas de destinataire fixe
                targetUserId = null;
            } else {
                // Staff → client : le seul participant est le client
                targetUserId = convDoc.participants[0];
            }
        } else {
            // CAS 3 : conv 1-à-1 classique
            const otherParticipantId = convDoc.participants.find(
                (p) => p.toString() !== req.user.id.toString()
            );
            if (!otherParticipantId) {
                cleanupUploadedFiles(uploadedFiles);
                res.status(404);
                throw new Error('Destinataire non trouvé dans la conversation.');
            }
            targetUserId = otherParticipantId;
        }
    }

    // --- 2. Vérifier le destinataire (sauf si staff-inbox sans cible fixe) ---
    let receiver = null;
    if (targetUserId) {
        receiver = await User.findById(targetUserId);
        if (!receiver) {
            cleanupUploadedFiles(uploadedFiles);
            res.status(404);
            throw new Error('Destinataire non trouvé.');
        }
    }

    // --- 3. Créer le message ---
    const message = await Message.create({
        sender: req.user.id,
        receiver: targetUserId || null,
        conversation: convDoc?._id || null,
        content,
        attachments: attachmentsData,
    });

    await message.populate('sender', 'name email avatar');
    if (targetUserId) {
        await message.populate('receiver', 'name email avatar');
    }

    // --- 4. Mettre à jour la Conversation (lastMessage + unreadCount) ---
    if (!convDoc) {
        convDoc = await Conversation.findOne({
            participants: { $all: [req.user.id, targetUserId] },
        });
        if (!convDoc) {
            convDoc = await Conversation.create({
                participants: [req.user.id, targetUserId],
            });
        }
    }

    convDoc.lastMessage = content;

    if (targetUserId) {
        const recipientIdStr = targetUserId.toString();
        const currentCount = convDoc.unreadCount?.get(recipientIdStr) || 0;
        convDoc.unreadCount.set(recipientIdStr, currentCount + 1);
    }
    await convDoc.save();

    const preview = content.length > 100 ? content.slice(0, 100) + '…' : content;
    const senderName = req.user.name || 'Nouveau message';

    // --- 5. Notification temps réel ---
    try {
        if (isStaffInbox && !targetUserId) {
            // Client → staff : notifier tous les membres du staff
            const STAFF_ROLES = ['Admin', 'Collaborateur'];
            const staff = await User.find({ role: { $in: STAFF_ROLES } }).select('_id pushToken');
            for (const s of staff) {
                const sid = s._id.toString();
                getIO().to(sid).emit('new-staff-message', { conversationId: convDoc._id, message });
                if (!isUserOnline(sid) && s.pushToken) {
                    await sendExpoPushNotification(s.pushToken, senderName, preview, {
                        conversationId: convDoc._id.toString(), type: 'new_staff_message',
                    });
                }
            }
        } else if (targetUserId) {
            // Conv 1-à-1 ou staff → client : notifier le destinataire
            const recipientIdStr = targetUserId.toString();
            getIO().to(recipientIdStr).emit('new-message', { conversationId: convDoc._id, message });
            if (!isUserOnline(recipientIdStr)) {
                const r = await User.findById(recipientIdStr).select('pushToken');
                if (r?.pushToken) {
                    await sendExpoPushNotification(r.pushToken, senderName, preview, {
                        conversationId: convDoc._id.toString(), type: 'new_message',
                    });
                }
            }
        }
    } catch {
        // Socket.IO non initialisé — dégradation silencieuse
    }

    res.status(201).json({
        status: 'success',
        data: { message },
    });
});

/**
 * @description Obtenir les messages d'une conversation spécifique
 * @route GET /api/messages/:conversationId
 * @access Protected
 */
exports.getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  console.log(`📖 [getMessages] ConversationId: ${conversationId}, User: ${req.user.id}`);

  if (!conversationId || !conversationId.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error('ID de conversation invalide.');
  }

  const skip = (page - 1) * limit;

  // Résoudre la conversation pour identifier l'autre participant
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

  // Requête prioritaire par conversation._id, fallback sender/receiver pour messages legacy
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
    .populate('sender', 'name email avatar')
    .populate('receiver', 'name email avatar')
    .sort({ createdAt: 1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Message.countDocuments(msgQuery);

  await Message.updateMany(
    convDoc
      ? { conversation: convDoc._id, sender: { $ne: req.user.id }, isRead: false }
      : { sender: otherUserId, receiver: req.user.id, isRead: false },
    { isRead: true, readAt: Date.now() }
  );

  console.log(`✅ [getMessages] ${messages.length} messages trouvés dans la conversation`);

  res.status(200).json({
    status: 'success',
    results: messages.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: {
      messages,
    },
  });
});

/**
 * @description Marquer un message comme lu
 * @route PATCH /api/messages/:messageId/read
 * @access Protected
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);

  if (!message) {
    res.status(404);
    throw new Error('Message non trouvé.');
  }

  if (message.receiver.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  message.isRead = true;
  message.readAt = Date.now();
  await message.save();

  console.log(`✅ [markAsRead] Message ${message._id} marqué comme lu`);

  res.status(200).json({
    status: 'success',
    data: {
      message,
    },
  });
});

/**
 * @description Supprimer un message
 * @route DELETE /api/messages/:messageId
 * @access Protected
 */
exports.deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);

  if (!message) {
    res.status(404);
    throw new Error('Message non trouvé.');
  }

  if (
    message.sender.toString() !== req.user.id &&
    message.receiver.toString() !== req.user.id
  ) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  await Message.findByIdAndDelete(req.params.messageId);

  console.log(`✅ [deleteMessage] Message ${message._id} supprimé`);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

/**
 * @description Obtenir la liste des conversations
 * @route GET /api/messages/conversations
 * @access Protected
 */
exports.getConversations = asyncHandler(async (req, res) => {
  console.log(`💬 [getConversations] User: ${req.user.id}`);

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
        user: otherUser,
        lastMessage: message,
        unreadCount: 0,
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

  console.log(`✅ [getConversations] ${conversations.length} conversations trouvées`);

  res.status(200).json({
    status: 'success',
    results: conversations.length,
    data: {
      conversations,
    },
  });
});