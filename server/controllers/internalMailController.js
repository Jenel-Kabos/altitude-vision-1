// server/controllers/internalMailController.js
const asyncHandler = require('express-async-handler');
const InternalMail = require('../models/InternalMail');
const User = require('../models/User');

// Note: Avec Cloudinary, nous n'avons plus besoin de nettoyer les fichiers locaux manuellement
// const { cleanupUploadedFiles } = require('../middleware/uploadMiddleware'); 

/**
 * @description Envoyer un email interne
 * @route POST /api/internal-mails
 */
exports.sendInternalMail = asyncHandler(async (req, res) => {
  const { receiverId, content, subject, priority = 'Normale' } = req.body;
  const uploadedFiles = req.files || [];

  // Validation
  if (!receiverId || !content) {
    res.status(400);
    throw new Error('Le destinataire et le contenu sont requis.');
  }

  // Vérifier le destinataire
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    res.status(404);
    throw new Error('Destinataire non trouvé.');
  }

  // Préparer les pièces jointes (Compatible Cloudinary)
  const attachmentsData = uploadedFiles.map(file => ({
    filename: file.originalname,
    filepath: file.path, // URL Cloudinary
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

  await mail.populate('sender', 'name email photo');
  await mail.populate('receiver', 'name email photo');

  console.log(`✅ [InternalMail] Email envoyé de ${req.user.id} à ${receiverId}`);

  res.status(201).json({
    status: 'success',
    data: { message: mail },
  });
});

/**
 * @description Sauvegarder un brouillon
 */
exports.saveDraft = asyncHandler(async (req, res) => {
  const { receiverId, content, subject, priority = 'Normale' } = req.body;
  const uploadedFiles = req.files || [];

  if (!content && uploadedFiles.length === 0) {
    res.status(400);
    throw new Error('Le brouillon doit contenir au moins du texte ou une pièce jointe.');
  }

  const attachmentsData = uploadedFiles.map(file => ({
    filename: file.originalname,
    filepath: file.path,
    mimetype: file.mimetype,
    size: file.size
  }));

  const draft = await InternalMail.create({
    sender: req.user.id,
    receiver: receiverId || null,
    subject: subject || 'Sans objet',
    content: content || '',
    priority,
    attachments: attachmentsData,
    isDraft: true,
  });

  await draft.populate('sender', 'name email photo');
  if (draft.receiver) await draft.populate('receiver', 'name email photo');

  res.status(201).json({
    status: 'success',
    data: { message: draft },
  });
});

/**
 * @description Mettre à jour un brouillon
 */
exports.updateDraft = asyncHandler(async (req, res) => {
  const { draftId } = req.params;
  const { receiverId, content, subject, priority } = req.body;
  const uploadedFiles = req.files || [];

  const draft = await InternalMail.findOne({
    _id: draftId,
    sender: req.user.id,
    isDraft: true,
    isDeleted: false,
  });

  if (!draft) {
    res.status(404);
    throw new Error('Brouillon non trouvé.');
  }

  if (receiverId !== undefined) draft.receiver = receiverId || null;
  if (content !== undefined) draft.content = content;
  if (subject !== undefined) draft.subject = subject;
  if (priority !== undefined) draft.priority = priority;

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
  await draft.populate('sender', 'name email photo');
  if (draft.receiver) await draft.populate('receiver', 'name email photo');

  res.status(200).json({
    status: 'success',
    data: { message: draft },
  });
});

/**
 * @description Supprimer un brouillon
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

  res.status(204).json({ status: 'success', data: null });
});

/**
 * @description Récupérer les emails reçus (Inbox)
 * ✅ VERSION DIRECTE (SANS STATIC)
 */
exports.getInbox = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    receiver: req.user.id,
    isDraft: false,
    isDeleted: false,
  };

  const messages = await InternalMail.find(query)
    .populate('sender', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

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
 * @description Récupérer les emails envoyés
 * ✅ VERSION DIRECTE (SANS STATIC)
 */
exports.getSent = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    sender: req.user.id,
    isDraft: false,
    isDeleted: false,
  };

  const messages = await InternalMail.find(query)
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

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
 * @description Récupérer les emails non lus
 * ✅ VERSION DIRECTE (SANS STATIC)
 */
exports.getUnread = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    receiver: req.user.id,
    isRead: false,
    isDraft: false,
    isDeleted: false,
  };

  const messages = await InternalMail.find(query)
    .populate('sender', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

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
 * @description Récupérer les favoris
 * ✅ VERSION DIRECTE (SANS STATIC)
 */
exports.getStarred = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    $or: [
      { receiver: req.user.id, isStarred: true },
      { sender: req.user.id, isStarred: true }
    ],
    isDraft: false,
    isDeleted: false,
  };

  const messages = await InternalMail.find(query)
    .populate('sender', 'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

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
 * @description Récupérer les brouillons
 * ✅ VERSION DIRECTE (SANS STATIC)
 */
exports.getDrafts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    sender: req.user.id,
    isDraft: true,
    isDeleted: false,
  };

  const messages = await InternalMail.find(query)
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

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
 * @description Récupérer la corbeille
 * ✅ VERSION DIRECTE (SANS STATIC)
 */
exports.getTrash = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    $or: [
      { receiver: req.user.id, isDeleted: true },
      { sender: req.user.id, isDeleted: true }
    ],
  };

  const messages = await InternalMail.find(query)
    .populate('sender', 'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ deletedAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

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
 * @description Compter les emails non lus
 * ✅ VERSION DIRECTE (SANS STATIC)
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  // On utilise countDocuments directement, c'est plus sûr
  const unreadCount = await InternalMail.countDocuments({
    receiver: req.user.id,
    isRead: false,
    isDraft: false,
    isDeleted: false,
  });

  res.status(200).json({
    status: 'success',
    data: { unreadCount },
  });
});

/**
 * @description Marquer un email comme lu
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

  res.status(200).json({
    status: 'success',
    data: { message: mail },
  });
});

/**
 * @description Marquer un email comme non lu
 */
exports.markAsUnread = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);
  if (!mail) { res.status(404); throw new Error('Email non trouvé.'); }
  if (mail.receiver.toString() !== req.user.id) { res.status(403); throw new Error('Non autorisé.'); }

  mail.isRead = false;
  mail.readAt = null;
  await mail.save();

  res.status(200).json({ status: 'success', data: { message: mail } });
});

/**
 * @description Ajouter aux favoris
 */
exports.addStar = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);
  if (!mail) { res.status(404); throw new Error('Email non trouvé.'); }

  if (mail.sender.toString() !== req.user.id && mail.receiver?.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isStarred = true;
  await mail.save();
  res.status(200).json({ status: 'success', data: { message: mail } });
});

/**
 * @description Retirer des favoris
 */
exports.removeStar = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);
  if (!mail) { res.status(404); throw new Error('Email non trouvé.'); }

  if (mail.sender.toString() !== req.user.id && mail.receiver?.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isStarred = false;
  await mail.save();
  res.status(200).json({ status: 'success', data: { message: mail } });
});

/**
 * @description Déplacer vers la corbeille
 */
exports.moveToTrash = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);
  if (!mail) { res.status(404); throw new Error('Email non trouvé.'); }

  if (mail.sender.toString() !== req.user.id && mail.receiver?.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isDeleted = true;
  mail.deletedAt = Date.now();
  await mail.save();
  res.status(200).json({ status: 'success', data: { message: mail } });
});

/**
 * @description Restaurer de la corbeille
 */
exports.restoreFromTrash = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);
  if (!mail) { res.status(404); throw new Error('Email non trouvé.'); }

  if (mail.sender.toString() !== req.user.id && mail.receiver?.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isDeleted = false;
  mail.deletedAt = null;
  await mail.save();
  res.status(200).json({ status: 'success', data: { message: mail } });
});

/**
 * @description Supprimer définitivement
 */
exports.permanentlyDelete = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findOne({
    _id: req.params.mailId,
    isDeleted: true,
  });

  if (!mail) { res.status(404); throw new Error('Email non trouvé dans la corbeille.'); }

  if (mail.sender.toString() !== req.user.id && mail.receiver?.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  await InternalMail.findByIdAndDelete(req.params.mailId);
  res.status(204).json({ status: 'success', data: null });
});

/**
 * @description Vider la corbeille
 */
exports.emptyTrash = asyncHandler(async (req, res) => {
  const result = await InternalMail.deleteMany({
    $or: [
      { sender: req.user.id, isDeleted: true },
      { receiver: req.user.id, isDeleted: true }
    ],
  });

  res.status(200).json({
    status: 'success',
    data: { deletedCount: result.deletedCount },
  });
});