// server/controllers/internalMailController.js
const asyncHandler = require('express-async-handler');
const InternalMail = require('../models/InternalMail');
const User = require('../models/User');
const { cleanupUploadedFiles } = require('../middleware/uploadMiddleware');

/**
 * @description Envoyer un email interne
 * @route POST /api/internal-mails
 * @access Protected
 */
exports.sendInternalMail = asyncHandler(async (req, res) => {
  const { receiverId, content, subject, priority = 'Normale' } = req.body;
  const uploadedFiles = req.files || [];

  // Validation
  if (!receiverId || !content) {
    cleanupUploadedFiles(uploadedFiles);
    res.status(400);
    throw new Error('Le destinataire et le contenu sont requis.');
  }

  // Vérifier le destinataire
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    cleanupUploadedFiles(uploadedFiles);
    res.status(404);
    throw new Error('Destinataire non trouvé.');
  }

  // Préparer les pièces jointes
  const attachmentsData = uploadedFiles.map(file => ({
    filename: file.originalname,
    filepath: file.path,
    mimetype: file.mimetype,
    size: file.size
  }));

  // Créer l'email
  const mail = await InternalMail.create({
    sender: req.user.id,
    receiver: receiverId,
    subject: subject || 'Sans objet',
    content,
    priority,
    attachments: attachmentsData,
    isDraft: false,
  });

  await mail.populate('sender', 'name email avatar');
  await mail.populate('receiver', 'name email avatar');

  console.log(`✅ [InternalMail] Email envoyé de ${req.user.id} à ${receiverId}`);

  res.status(201).json({
    status: 'success',
    data: {
      message: mail,
    },
  });
});

/**
 * @description Sauvegarder un brouillon
 * @route POST /api/internal-mails/drafts
 * @access Protected
 */
exports.saveDraft = asyncHandler(async (req, res) => {
  const { receiverId, content, subject, priority = 'Normale' } = req.body;
  const uploadedFiles = req.files || [];

  // Pour un brouillon, le contenu peut être vide
  if (!content && uploadedFiles.length === 0) {
    cleanupUploadedFiles(uploadedFiles);
    res.status(400);
    throw new Error('Le brouillon doit contenir au moins du texte ou une pièce jointe.');
  }

  // Préparer les pièces jointes
  const attachmentsData = uploadedFiles.map(file => ({
    filename: file.originalname,
    filepath: file.path,
    mimetype: file.mimetype,
    size: file.size
  }));

  // Créer le brouillon
  const draft = await InternalMail.create({
    sender: req.user.id,
    receiver: receiverId || null, // Le destinataire peut être vide pour un brouillon
    subject: subject || 'Sans objet',
    content: content || '',
    priority,
    attachments: attachmentsData,
    isDraft: true,
  });

  if (receiverId) {
    await draft.populate('receiver', 'name email avatar');
  }
  await draft.populate('sender', 'name email avatar');

  console.log(`✅ [InternalMail] Brouillon sauvegardé par ${req.user.id}`);

  res.status(201).json({
    status: 'success',
    data: {
      message: draft,
    },
  });
});

/**
 * @description Mettre à jour un brouillon
 * @route PUT /api/internal-mails/drafts/:draftId
 * @access Protected
 */
exports.updateDraft = asyncHandler(async (req, res) => {
  const { draftId } = req.params;
  const { receiverId, content, subject, priority } = req.body;
  const uploadedFiles = req.files || [];

  // Trouver le brouillon
  const draft = await InternalMail.findOne({
    _id: draftId,
    sender: req.user.id,
    isDraft: true,
    isDeleted: false,
  });

  if (!draft) {
    cleanupUploadedFiles(uploadedFiles);
    res.status(404);
    throw new Error('Brouillon non trouvé.');
  }

  // Mettre à jour les champs
  if (receiverId !== undefined) draft.receiver = receiverId || null;
  if (content !== undefined) draft.content = content;
  if (subject !== undefined) draft.subject = subject;
  if (priority !== undefined) draft.priority = priority;

  // Ajouter les nouvelles pièces jointes
  if (uploadedFiles.length > 0) {
    const newAttachments = uploadedFiles.map(file => ({
      filename: file.originalname,
      filepath: file.path,
      mimetype: file.mimetype,
      size: file.size
    }));
    draft.attachments = [...draft.attachments, ...newAttachments];
  }

  await draft.save();
  await draft.populate('sender', 'name email avatar');
  if (draft.receiver) {
    await draft.populate('receiver', 'name email avatar');
  }

  console.log(`✅ [InternalMail] Brouillon ${draftId} mis à jour`);

  res.status(200).json({
    status: 'success',
    data: {
      message: draft,
    },
  });
});

/**
 * @description Supprimer un brouillon
 * @route DELETE /api/internal-mails/drafts/:draftId
 * @access Protected
 */
exports.deleteDraft = asyncHandler(async (req, res) => {
  const { draftId } = req.params;

  const draft = await InternalMail.findOneAndDelete({
    _id: draftId,
    sender: req.user.id,
    isDraft: true,
  });

  if (!draft) {
    res.status(404);
    throw new Error('Brouillon non trouvé.');
  }

  // TODO: Nettoyer les fichiers attachés si nécessaire
  console.log(`✅ [InternalMail] Brouillon ${draftId} supprimé`);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

/**
 * @description Récupérer les emails reçus (Inbox)
 * @route GET /api/internal-mails/received
 * @access Protected
 */
exports.getInbox = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  console.log(`📥 [InternalMail] Inbox - User: ${req.user.id}`);

  const messages = await InternalMail.getInbox(req.user.id, { page, limit });
  const total = await InternalMail.countDocuments({
    receiver: req.user.id,
    isDraft: false,
    isDeleted: false,
  });

  console.log(`✅ [InternalMail] ${messages.length} emails reçus`);

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
 * @description Récupérer les emails envoyés
 * @route GET /api/internal-mails/sent
 * @access Protected
 */
exports.getSent = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  console.log(`📤 [InternalMail] Sent - User: ${req.user.id}`);

  const messages = await InternalMail.getSent(req.user.id, { page, limit });
  const total = await InternalMail.countDocuments({
    sender: req.user.id,
    isDraft: false,
    isDeleted: false,
  });

  console.log(`✅ [InternalMail] ${messages.length} emails envoyés`);

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
 * @description Récupérer les emails non lus
 * @route GET /api/internal-mails/unread
 * @access Protected
 */
exports.getUnread = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  console.log(`📬 [InternalMail] Unread - User: ${req.user.id}`);

  const messages = await InternalMail.getUnread(req.user.id, { page, limit });
  const total = await InternalMail.countDocuments({
    receiver: req.user.id,
    isRead: false,
    isDraft: false,
    isDeleted: false,
  });

  console.log(`✅ [InternalMail] ${messages.length} emails non lus`);

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
 * @description Récupérer les emails favoris
 * @route GET /api/internal-mails/starred
 * @access Protected
 */
exports.getStarred = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  console.log(`⭐ [InternalMail] Starred - User: ${req.user.id}`);

  const messages = await InternalMail.getStarred(req.user.id, { page, limit });
  const total = await InternalMail.countDocuments({
    $or: [
      { receiver: req.user.id, isStarred: true },
      { sender: req.user.id, isStarred: true }
    ],
    isDraft: false,
    isDeleted: false,
  });

  console.log(`✅ [InternalMail] ${messages.length} emails favoris`);

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
 * @description Récupérer les brouillons
 * @route GET /api/internal-mails/drafts
 * @access Protected
 */
exports.getDrafts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  console.log(`📝 [InternalMail] Drafts - User: ${req.user.id}`);

  const messages = await InternalMail.getDrafts(req.user.id, { page, limit });
  const total = await InternalMail.countDocuments({
    sender: req.user.id,
    isDraft: true,
    isDeleted: false,
  });

  console.log(`✅ [InternalMail] ${messages.length} brouillons`);

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
 * @description Récupérer la corbeille
 * @route GET /api/internal-mails/trash
 * @access Protected
 */
exports.getTrash = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  console.log(`🗑️ [InternalMail] Trash - User: ${req.user.id}`);

  const messages = await InternalMail.getTrash(req.user.id, { page, limit });
  const total = await InternalMail.countDocuments({
    $or: [
      { receiver: req.user.id, isDeleted: true },
      { sender: req.user.id, isDeleted: true }
    ],
  });

  console.log(`✅ [InternalMail] ${messages.length} emails dans la corbeille`);

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
 * @description Compter les emails non lus (InternalMail)
 * @route GET /api/internal-mails/count/unread
 * @access Protected
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await InternalMail.countUnread(req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      unreadCount,
    },
  });
});

/**
 * @description Marquer un email comme lu
 * @route PATCH /api/internal-mails/:mailId/read
 * @access Protected
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);

  if (!mail) {
    res.status(404);
    throw new Error('Email non trouvé.');
  }

  // Vérifier que l'utilisateur est le destinataire
  if (mail.receiver.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isRead = true;
  mail.readAt = Date.now();
  await mail.save();

  console.log(`✅ [InternalMail] Email ${mail._id} marqué comme lu`);

  res.status(200).json({
    status: 'success',
    data: {
      message: mail,
    },
  });
});

/**
 * @description Marquer un email comme non lu
 * @route PATCH /api/internal-mails/:mailId/unread
 * @access Protected
 */
exports.markAsUnread = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);

  if (!mail) {
    res.status(404);
    throw new Error('Email non trouvé.');
  }

  if (mail.receiver.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isRead = false;
  mail.readAt = null;
  await mail.save();

  console.log(`✅ [InternalMail] Email ${mail._id} marqué comme non lu`);

  res.status(200).json({
    status: 'success',
    data: {
      message: mail,
    },
  });
});

/**
 * @description Ajouter aux favoris
 * @route PATCH /api/internal-mails/:mailId/star
 * @access Protected
 */
exports.addStar = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);

  if (!mail) {
    res.status(404);
    throw new Error('Email non trouvé.');
  }

  // Vérifier que l'utilisateur est l'expéditeur ou le destinataire
  if (
    mail.sender.toString() !== req.user.id &&
    mail.receiver?.toString() !== req.user.id
  ) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isStarred = true;
  await mail.save();

  console.log(`✅ [InternalMail] Email ${mail._id} ajouté aux favoris`);

  res.status(200).json({
    status: 'success',
    data: {
      message: mail,
    },
  });
});

/**
 * @description Retirer des favoris
 * @route PATCH /api/internal-mails/:mailId/unstar
 * @access Protected
 */
exports.removeStar = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);

  if (!mail) {
    res.status(404);
    throw new Error('Email non trouvé.');
  }

  if (
    mail.sender.toString() !== req.user.id &&
    mail.receiver?.toString() !== req.user.id
  ) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isStarred = false;
  await mail.save();

  console.log(`✅ [InternalMail] Email ${mail._id} retiré des favoris`);

  res.status(200).json({
    status: 'success',
    data: {
      message: mail,
    },
  });
});

/**
 * @description Déplacer vers la corbeille
 * @route PATCH /api/internal-mails/:mailId/trash
 * @access Protected
 */
exports.moveToTrash = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);

  if (!mail) {
    res.status(404);
    throw new Error('Email non trouvé.');
  }

  if (
    mail.sender.toString() !== req.user.id &&
    mail.receiver?.toString() !== req.user.id
  ) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isDeleted = true;
  mail.deletedAt = Date.now();
  await mail.save();

  console.log(`✅ [InternalMail] Email ${mail._id} déplacé vers la corbeille`);

  res.status(200).json({
    status: 'success',
    data: {
      message: mail,
    },
  });
});

/**
 * @description Restaurer de la corbeille
 * @route PATCH /api/internal-mails/:mailId/restore
 * @access Protected
 */
exports.restoreFromTrash = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);

  if (!mail) {
    res.status(404);
    throw new Error('Email non trouvé.');
  }

  if (
    mail.sender.toString() !== req.user.id &&
    mail.receiver?.toString() !== req.user.id
  ) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isDeleted = false;
  mail.deletedAt = null;
  await mail.save();

  console.log(`✅ [InternalMail] Email ${mail._id} restauré`);

  res.status(200).json({
    status: 'success',
    data: {
      message: mail,
    },
  });
});

/**
 * @description Supprimer définitivement
 * @route DELETE /api/internal-mails/:mailId/permanent
 * @access Protected
 */
exports.permanentlyDelete = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findOne({
    _id: req.params.mailId,
    isDeleted: true, // Seulement depuis la corbeille
  });

  if (!mail) {
    res.status(404);
    throw new Error('Email non trouvé dans la corbeille.');
  }

  if (
    mail.sender.toString() !== req.user.id &&
    mail.receiver?.toString() !== req.user.id
  ) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  await InternalMail.findByIdAndDelete(req.params.mailId);

  // TODO: Nettoyer les fichiers attachés
  console.log(`✅ [InternalMail] Email ${req.params.mailId} supprimé définitivement`);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

/**
 * @description Vider la corbeille
 * @route DELETE /api/internal-mails/trash/empty
 * @access Protected
 */
exports.emptyTrash = asyncHandler(async (req, res) => {
  const result = await InternalMail.deleteMany({
    $or: [
      { sender: req.user.id, isDeleted: true },
      { receiver: req.user.id, isDeleted: true }
    ],
  });

  console.log(`✅ [InternalMail] Corbeille vidée - ${result.deletedCount} emails supprimés`);

  res.status(200).json({
    status: 'success',
    data: {
      deletedCount: result.deletedCount,
    },
  });
});