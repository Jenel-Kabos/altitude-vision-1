// server/controllers/messageController.js
// ⚠️ CE CONTRÔLEUR EST POUR LES CONVERSATIONS EN TEMPS RÉEL UNIQUEMENT
// Pour les emails internes, utilisez internalMailController.js

const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { cleanupUploadedFiles } = require('../middleware/uploadMiddleware'); 

/**
 * @description Envoyer un message dans une conversation
 * @route POST /api/messages
 * @access Protected
 */
exports.sendMessage = asyncHandler(async (req, res) => {
    // Pour les conversations, on peut recevoir soit conversationId + content, 
    // soit receiverId + content (pour créer une nouvelle conversation)
    const { conversationId, receiverId, content } = req.body;
    const uploadedFiles = req.files || [];

    // --- 1. Validation ---
    if (!content || (!conversationId && !receiverId)) {
        cleanupUploadedFiles(uploadedFiles);
        res.status(400);
        throw new Error('Le contenu et soit conversationId ou receiverId sont requis.');
    }

    // Préparer les pièces jointes
    const attachmentsData = uploadedFiles.map(file => ({
        filename: file.originalname,
        filepath: file.path,
        mimetype: file.mimetype,
        size: file.size
    }));

    let targetUserId;
    
    // ✅ CORRECTION : conversationId représente directement l'ID de l'autre utilisateur
    // Pas besoin de chercher une conversation dans la base
    if (conversationId) {
        targetUserId = conversationId;
    } else {
        targetUserId = receiverId;
    }

    // --- 2. Vérifier le destinataire ---
    const receiver = await User.findById(targetUserId);
    if (!receiver) {
        cleanupUploadedFiles(uploadedFiles);
        res.status(404);
        throw new Error('Destinataire non trouvé.');
    }

    // --- 3. Créer le message ---
    const message = await Message.create({
        sender: req.user.id,
        receiver: targetUserId,
        content,
        attachments: attachmentsData,
    });

    await message.populate('sender', 'name email avatar');
    await message.populate('receiver', 'name email avatar');

    res.status(201).json({
        status: 'success',
        data: {
            message,
        },
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

  // Vérifier que conversationId est un ObjectId valide
  if (!conversationId || !conversationId.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error('ID de conversation invalide.');
  }

  const skip = (page - 1) * limit;

  // Trouver les messages entre l'utilisateur et un autre utilisateur
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

  // Vérifier que l'utilisateur est le destinataire
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

  // Vérifier que l'utilisateur est l'expéditeur ou le destinataire
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

  // Trouver tous les utilisateurs avec qui l'utilisateur a échangé
  const messages = await Message.find({
    $or: [{ sender: req.user.id }, { receiver: req.user.id }],
  })
    .populate('sender', 'name email avatar')
    .populate('receiver', 'name email avatar')
    .sort({ createdAt: -1 });

  // Créer une map des conversations uniques
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

  console.log(`✅ [getConversations] ${conversations.length} conversations trouvées`);

  res.status(200).json({
    status: 'success',
    results: conversations.length,
    data: {
      conversations,
    },
  });
});