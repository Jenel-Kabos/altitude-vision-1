// server/controllers/messageController.js
// ⚠️ CE CONTRÔLEUR EST POUR LES CONVERSATIONS EN TEMPS RÉEL UNIQUEMENT
// Pour les emails internes, utilisez internalMailController.js

const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { uploadToCloudinary } = require('../config/cloudinary');
const { getIO } = require('../socket');
const { notify, notifyStaff } = require('../services/notificationService');
const { ALL_STAFF } = require('../utils/roles');
const logger = require('../utils/logger');
const { assertResourceTenant, resolveResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');

/**
 * @description Envoyer un message dans une conversation
 * @route POST /api/messages
 * @access Protected
 */
exports.sendMessage = asyncHandler(async (req, res) => {
    const { conversationId, receiverId, content, duration } = req.body;
    const uploadedFiles = req.files || [];

    // --- 1. Validation ---
    if ((!content && !uploadedFiles.length) || (!conversationId && !receiverId)) {
        res.status(400);
        throw new Error('Le contenu ou une pièce jointe, et soit conversationId ou receiverId sont requis.');
    }

    // --- 1bis. Upload des pièces jointes vers Cloudinary ---
    // Extraction de durée : pas de ffprobe côté serveur (dépendance binaire lourde,
    // hors scope pour un simple message). Le client peut mesurer la durée lui-même
    // (mobile : sound.getStatusAsync()/video.getStatusAsync() d'expo-av ; web :
    // l'évènement 'loadedmetadata' de <audio>/<video>) et l'envoyer en secondes
    // dans le champ `duration` du FormData. Non implémenté côté ChatScreen.jsx /
    // MessagesPage.jsx dans cette passe — seul le backend est prêt à la recevoir.
    // Limite : un seul champ `duration` par requête, appliqué au premier
    // attachment audio/vidéo — pas de mapping par fichier si plusieurs médias
    // datés sont envoyés dans le même message.
    let durationApplied = false;
    const attachmentsData = [];
    if (uploadedFiles.length) {
        for (const file of uploadedFiles) {
            const isVideo = file.mimetype.startsWith('video/');
            const isAudio = file.mimetype.startsWith('audio/');
            const isImage = file.mimetype.startsWith('image/');
            // Cloudinary n'a pas de resource_type dédié à l'audio — 'video' couvre les deux.
            const resourceType = (isVideo || isAudio) ? 'video' : isImage ? 'image' : 'raw';

            const result = await uploadToCloudinary(file.buffer, {
                folder:        'altitude-vision/messages',
                resource_type: resourceType,
            });

            let attDuration;
            if ((isVideo || isAudio) && duration && !durationApplied) {
                attDuration = Number(duration) || undefined;
                durationApplied = true;
            }

            attachmentsData.push({
                url:      result.secure_url,
                type:     isVideo ? 'video' : isAudio ? 'audio' : isImage ? 'image' : 'file',
                nom:      file.originalname,
                size:     file.size,
                duration: attDuration,
            });
        }
    }

    let targetUserId = null;
    let convDoc = null;
    let isStaffInbox = false;

    if (receiverId) {
        // CAS 1 : receiverId fourni directement (conv 1-à-1)
        targetUserId = receiverId;
    } else if (conversationId) {
        convDoc = await Conversation.findById(conversationId);
        if (!convDoc) {
            res.status(404);
            throw new Error('Conversation non trouvée.');
        }
        await assertResourceTenant({ resourceType: 'Conversation', resource: convDoc, tenantId: req.platformTenant._id });

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
            res.status(404);
            throw new Error('Destinataire non trouvé.');
        }
        const receiverTenant = await resolveResourceTenant({ resourceType: 'User', resource: receiver });
        if (receiverTenant.status !== 'resolved' || String(receiverTenant.tenantId) !== String(req.platformTenant._id)) {
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
        tenant: req.platformTenant._id,
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
                tenant: req.platformTenant._id,
            });
        }
    }

    convDoc.lastMessage = content;

    if (targetUserId) {
        const recipientIdStr = targetUserId.toString();
        const currentCount = convDoc.unreadCount?.get(recipientIdStr) || 0;
        convDoc.unreadCount.set(recipientIdStr, currentCount + 1);
        // Staff → client sur une boîte partagée : l'équipe vient de répondre,
        // on efface le signal "non-lu côté staff".
        if (isStaffInbox) convDoc.unreadCount.set('staff', 0);
    } else if (isStaffInbox) {
        // Client → boîte staff partagée : pas de destinataire unique fixe,
        // clé partagée 'staff' pour signaler un message client en attente.
        const staffCount = convDoc.unreadCount?.get('staff') || 0;
        convDoc.unreadCount.set('staff', staffCount + 1);
    }
    await convDoc.save();

    const preview = content.length > 100 ? content.slice(0, 100) + '…' : content;
    const senderName = req.user.name || 'Nouveau message';

    // --- 5. Notification temps réel (chat UI) + persistante (cloche/liste) ---
    // Les events 'new-message'/'new-staff-message' rafraîchissent le chat en direct
    // (ChatScreen, StaffInboxPage, MessagesPage...) ; notify()/notifyStaff() créent
    // en plus l'enregistrement Notification persistant (cloche, badge, push Expo
    // si hors-ligne — géré en interne, pas besoin de dupliquer l'appel ici).
    try {
        if (isStaffInbox && !targetUserId) {
            // Client → staff : notifier tous les membres du staff
            const staff = await User.find({ role: { $in: ALL_STAFF } }).select('_id');
            for (const s of staff) {
                getIO().to(s._id.toString()).emit('new-staff-message', { conversationId: convDoc._id, message });
            }
            console.log('[NOTIF DEBUG] notifyStaff appelé, staff roles:', ALL_STAFF);
            notifyStaff({
                type: 'new_staff_message',
                title: senderName,
                body: preview,
                data: { conversationId: convDoc._id.toString(), screen: 'Conversations' },
            }).catch(() => {});
        } else if (targetUserId) {
            // Conv 1-à-1 ou staff → client : notifier le destinataire
            const recipientIdStr = targetUserId.toString();
            getIO().to(recipientIdStr).emit('new-message', { conversationId: convDoc._id, message });
            console.log('[NOTIF DEBUG] notify appelé pour:', recipientIdStr);
            notify({ recipient: recipientIdStr,
                type: isStaffInbox ? 'message_staff' : 'new_message',
                title: senderName,
                body: preview,
                data: { conversationId: convDoc._id.toString(), screen: 'Chat' },
            }).catch(() => {});
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

  logger.info(`📖 [getMessages] ConversationId: ${conversationId}, User: ${req.user.id}`);

  if (!conversationId || !conversationId.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error('ID de conversation invalide.');
  }

  const skip = (page - 1) * limit;

  // Résoudre la conversation pour identifier l'autre participant
  let otherUserId = conversationId;
  const convDoc = await Conversation.findById(conversationId);
  if (convDoc) {
    await assertResourceTenant({ resourceType: 'Conversation', resource: convDoc, tenantId: req.platformTenant._id });
    const otherParticipant = convDoc.participants.find(
      (p) => p.toString() !== req.user.id.toString()
    );
    if (otherParticipant) {
      otherUserId = otherParticipant.toString();
    }
  } else {
    res.status(404);
    throw new Error('Conversation non trouvée.');
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

  logger.success(`✅ [getMessages] ${messages.length} messages trouvés dans la conversation`);

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

  await assertResourceTenant({ resourceType: 'Message', resource: message, tenantId: req.platformTenant._id });

  if (message.receiver.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  message.isRead = true;
  message.readAt = Date.now();
  await message.save();

  logger.success(`✅ [markAsRead] Message ${message._id} marqué comme lu`);

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

  await assertResourceTenant({ resourceType: 'Message', resource: message, tenantId: req.platformTenant._id });

  if (
    message.sender.toString() !== req.user.id &&
    message.receiver.toString() !== req.user.id
  ) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  await Message.findByIdAndDelete(req.params.messageId);

  logger.success(`✅ [deleteMessage] Message ${message._id} supprimé`);

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
  logger.info(`💬 [getConversations] User: ${req.user.id}`);

  const candidates = await Message.find({
    $and: [
      { $or: [{ sender: req.user.id }, { receiver: req.user.id }] },
      { $or: [{ tenant: req.platformTenant._id }, { tenant: null }] },
    ],
  })
    .populate('sender', 'name email avatar')
    .populate('receiver', 'name email avatar')
    .sort({ createdAt: -1 });
  const messages = [];
  for (const message of candidates) {
    try {
      await assertResourceTenant({ resourceType: 'Message', resource: message, tenantId: req.platformTenant._id });
      messages.push(message);
    } catch {}
  }

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

  logger.success(`✅ [getConversations] ${conversations.length} conversations trouvées`);

  res.status(200).json({
    status: 'success',
    results: conversations.length,
    data: {
      conversations,
    },
  });
});
