// server/controllers/internalMessageController.js
const InternalMessage = require('../models/InternalMessage');
const asyncHandler = require('express-async-handler');

/* ======================================================
   💬 ENVOYER UN MESSAGE
====================================================== */
exports.sendMessage = asyncHandler(async (req, res) => {
  const {
    recipients,
    content,
    subject,
    attachments,
    messageType,
    priority,
    threadId,
    relatedTo,
  } = req.body;

  // Validation
  if (!recipients || recipients.length === 0) {
    res.status(400);
    throw new Error('Au moins un destinataire est requis');
  }

  if (!content || content.trim() === '') {
    res.status(400);
    throw new Error('Le contenu du message est requis');
  }

  // Créer le message
  const message = await InternalMessage.create({
    sender: req.user._id,
    recipients,
    content,
    subject,
    attachments: attachments || [],
    messageType: messageType || 'Message',
    priority: priority || 'Normale',
    threadId: threadId || null,
    relatedTo: relatedTo || null,
  });

  // Peupler les champs
  await message.populate('sender', 'name email photo role');
  await message.populate('recipients', 'name email photo role');

  res.status(201).json({
    status: 'success',
    message: '✅ Message envoyé avec succès',
    data: { message },
  });
});

/* ======================================================
   📬 RÉCUPÉRER LES MESSAGES REÇUS
====================================================== */
exports.getReceivedMessages = asyncHandler(async (req, res) => {
  const messages = await InternalMessage.getReceivedMessages(req.user._id);

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: { messages },
  });
});

/* ======================================================
   📤 RÉCUPÉRER LES MESSAGES ENVOYÉS
====================================================== */
exports.getSentMessages = asyncHandler(async (req, res) => {
  const messages = await InternalMessage.getSentMessages(req.user._id);

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: { messages },
  });
});

/* ======================================================
   📭 RÉCUPÉRER LES MESSAGES NON LUS
====================================================== */
exports.getUnreadMessages = asyncHandler(async (req, res) => {
  const messages = await InternalMessage.getUnreadMessages(req.user._id);

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: { messages },
  });
});

/* ======================================================
   ⭐ RÉCUPÉRER LES MESSAGES FAVORIS
====================================================== */
exports.getStarredMessages = asyncHandler(async (req, res) => {
  const messages = await InternalMessage.getStarredMessages(req.user._id);

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: { messages },
  });
});

/* ======================================================
   🔍 RÉCUPÉRER UN MESSAGE PAR ID
====================================================== */
exports.getMessageById = asyncHandler(async (req, res) => {
  const message = await InternalMessage.findById(req.params.id)
    .populate('sender', 'name email photo role')
    .populate('recipients', 'name email photo role')
    .populate('readBy.user', 'name email photo');

  if (!message) {
    res.status(404);
    throw new Error('Message introuvable');
  }

  // Vérifier que l'utilisateur a accès à ce message
  const hasAccess =
    message.sender._id.toString() === req.user._id.toString() ||
    message.recipients.some(r => r._id.toString() === req.user._id.toString());

  if (!hasAccess) {
    res.status(403);
    throw new Error('Accès refusé à ce message');
  }

  // Marquer comme lu si l'utilisateur est un destinataire
  const isRecipient = message.recipients.some(
    r => r._id.toString() === req.user._id.toString()
  );

  if (isRecipient) {
    await message.markAsReadBy(req.user._id);
  }

  res.status(200).json({
    status: 'success',
    data: { message },
  });
});

/* ======================================================
   💬 RÉCUPÉRER UN FIL DE CONVERSATION
====================================================== */
exports.getThread = asyncHandler(async (req, res) => {
  const { threadId } = req.params;

  const thread = await InternalMessage.getThread(threadId);

  // Vérifier que l'utilisateur a accès à ce fil
  const hasAccess = thread.some(
    msg =>
      msg.sender.toString() === req.user._id.toString() ||
      msg.recipients.some(r => r.toString() === req.user._id.toString())
  );

  if (!hasAccess) {
    res.status(403);
    throw new Error('Accès refusé à ce fil de conversation');
  }

  res.status(200).json({
    status: 'success',
    results: thread.length,
    data: { thread },
  });
});

/* ======================================================
   👁️ MARQUER COMME LU
====================================================== */
exports.markAsRead = asyncHandler(async (req, res) => {
  const message = await InternalMessage.findById(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('Message introuvable');
  }

  // Vérifier que l'utilisateur est un destinataire
  const isRecipient = message.recipients.some(
    r => r.toString() === req.user._id.toString()
  );

  if (!isRecipient) {
    res.status(403);
    throw new Error('Vous n\'êtes pas destinataire de ce message');
  }

  await message.markAsReadBy(req.user._id);
  await message.populate('sender', 'name email photo role');
  await message.populate('recipients', 'name email photo role');

  res.status(200).json({
    status: 'success',
    message: '✅ Message marqué comme lu',
    data: { message },
  });
});

/* ======================================================
   👁️ MARQUER COMME NON LU
====================================================== */
exports.markAsUnread = asyncHandler(async (req, res) => {
  const message = await InternalMessage.findById(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('Message introuvable');
  }

  await message.markAsUnreadBy(req.user._id);
  await message.populate('sender', 'name email photo role');
  await message.populate('recipients', 'name email photo role');

  res.status(200).json({
    status: 'success',
    message: '✅ Message marqué comme non lu',
    data: { message },
  });
});

/* ======================================================
   ⭐ AJOUTER AUX FAVORIS
====================================================== */
exports.addStar = asyncHandler(async (req, res) => {
  const message = await InternalMessage.findById(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('Message introuvable');
  }

  await message.addStar(req.user._id);
  await message.populate('sender', 'name email photo role');
  await message.populate('recipients', 'name email photo role');

  res.status(200).json({
    status: 'success',
    message: '⭐ Message ajouté aux favoris',
    data: { message },
  });
});

/* ======================================================
   ⭐ RETIRER DES FAVORIS
====================================================== */
exports.removeStar = asyncHandler(async (req, res) => {
  const message = await InternalMessage.findById(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('Message introuvable');
  }

  await message.removeStar(req.user._id);
  await message.populate('sender', 'name email photo role');
  await message.populate('recipients', 'name email photo role');

  res.status(200).json({
    status: 'success',
    message: '✅ Message retiré des favoris',
    data: { message },
  });
});

/* ======================================================
   🗑️ SUPPRIMER UN MESSAGE (SOFT DELETE)
====================================================== */
exports.deleteMessage = asyncHandler(async (req, res) => {
  const message = await InternalMessage.findById(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('Message introuvable');
  }

  await message.deleteForUser(req.user._id);

  res.status(200).json({
    status: 'success',
    message: '✅ Message supprimé',
    data: null,
  });
});

/* ======================================================
   📊 COMPTER LES MESSAGES NON LUS
====================================================== */
exports.countUnread = asyncHandler(async (req, res) => {
  const count = await InternalMessage.countUnread(req.user._id);

  res.status(200).json({
    status: 'success',
    data: { unreadCount: count },
  });
});

/* ======================================================
   💼 RÉCUPÉRER LES CONVERSATIONS RÉCENTES
====================================================== */
exports.getRecentConversations = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const conversations = await InternalMessage.getRecentConversations(req.user._id, limit);

  res.status(200).json({
    status: 'success',
    results: conversations.length,
    data: { conversations },
  });
});

/* ======================================================
   📦 ARCHIVER UN MESSAGE
====================================================== */
exports.archiveMessage = asyncHandler(async (req, res) => {
  const message = await InternalMessage.findById(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('Message introuvable');
  }

  // Vérifier l'accès
  const hasAccess =
    message.sender.toString() === req.user._id.toString() ||
    message.recipients.some(r => r.toString() === req.user._id.toString());

  if (!hasAccess) {
    res.status(403);
    throw new Error('Accès refusé');
  }

  await message.archive();
  await message.populate('sender', 'name email photo role');
  await message.populate('recipients', 'name email photo role');

  res.status(200).json({
    status: 'success',
    message: '✅ Message archivé',
    data: { message },
  });
});

/* ======================================================
   🔍 RECHERCHER DES MESSAGES
====================================================== */
exports.searchMessages = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim() === '') {
    res.status(400);
    throw new Error('Une requête de recherche est requise');
  }

  // Deux clés $or dans le même objet littéral se réécrivent silencieusement
  // en JS (seule la dernière survit) : la restriction d'accès (participant
  // uniquement) disparaissait, exposant la recherche à TOUS les messages de
  // la collection. Fusionné dans $and pour que les deux conditions s'appliquent.
  const messages = await InternalMessage.find({
    $and: [
      { $or: [{ sender: req.user._id }, { recipients: req.user._id }] },
      { $or: [
        { content: { $regex: query, $options: 'i' } },
        { subject: { $regex: query, $options: 'i' } },
      ] },
    ],
    deletedBy: { $ne: req.user._id },
  })
    .populate('sender', 'name email photo role')
    .populate('recipients', 'name email photo role')
    .sort({ createdAt: -1 })
    .limit(50);

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: { messages },
  });
});