// server/controllers/internalMailController.js
const asyncHandler = require('express-async-handler');
const InternalMail = require('../models/InternalMail');
const User = require('../models/User');
const { sendEmailViaZoho } = require('../services/emailService');

// ═══════════════════════════════════════════════════════════════
// MISE À JOUR DU SCHÉMA MONGOOSE REQUISE
// Ajoutez ces champs à votre modèle InternalMail :
//
//   senderName:     { type: String },
//   senderEmail:    { type: String },
//   receiverEmail:  { type: String },
//   isExternalMail: { type: Boolean, default: false },
//   zohoMessageId:  { type: String, unique: true, sparse: true },
// ═══════════════════════════════════════════════════════════════

/**
 * @description Envoyer un email interne OU externe (via Zoho)
 * @route POST /api/internal-mails
 */
exports.sendInternalMail = asyncHandler(async (req, res) => {
  const {
    isExternal,
    receiverEmail,
    receiverId,
    content,
    subject,
    priority = 'Normale',
  } = req.body;
  const uploadedFiles = req.files || [];

  // ══════════════════════════════════════════
  // CAS 1 — Envoi EXTERNE via Zoho
  // ══════════════════════════════════════════
  if (isExternal === 'true') {
    if (!receiverEmail) {
      res.status(400);
      throw new Error("L'adresse email du destinataire est requise pour un envoi externe.");
    }
    if (!content) {
      res.status(400);
      throw new Error('Le contenu du message est requis.');
    }

    // Récupérer l'expéditeur connecté
    const senderUser = await User.findById(req.user.id).select('name email zohoEmail');
    const fromEmail  = senderUser.zohoEmail || senderUser.email;

    if (!fromEmail) {
      res.status(400);
      throw new Error("Aucune adresse email Zoho configurée pour cet utilisateur.");
    }

    // Corps de l'email avec signature automatique
    const emailContent = `${content}\n\n---\nMessage envoyé depuis Altitude Vision\nPar : ${senderUser.name}`;

    // Envoi via Zoho
    await sendEmailViaZoho(fromEmail, receiverEmail, subject || 'Sans objet', emailContent);

    // Sauvegarder une trace dans "Messages envoyés"
    const sentRecord = await InternalMail.create({
      sender:         req.user.id,
      receiverEmail:  receiverEmail,
      isExternalMail: true,
      subject:        subject || 'Sans objet',
      content:        content,
      priority,
      isRead:         true,
      isDraft:        false,
      isDeleted:      false,
    });

    await sentRecord.populate('sender', 'name email photo');

    console.log(`✅ [InternalMail] Email externe envoyé de ${fromEmail} à ${receiverEmail}`);

    return res.status(201).json({
      status: 'success',
      data:   { message: sentRecord },
    });
  }

  // ══════════════════════════════════════════
  // CAS 2 — Envoi INTERNE (logique existante)
  // ══════════════════════════════════════════
  if (!receiverId || !content) {
    res.status(400);
    throw new Error('Le destinataire et le contenu sont requis.');
  }

  const receiver = await User.findById(receiverId);
  if (!receiver) {
    res.status(404);
    throw new Error('Destinataire non trouvé.');
  }

  const attachmentsData = uploadedFiles.map(file => ({
    filename: file.originalname,
    filepath: file.path,
    mimetype: file.mimetype,
    size:     file.size,
  }));

  const mail = await InternalMail.create({
    sender:      req.user.id,
    receiver:    receiverId,
    subject:     subject || 'Sans objet',
    content,
    priority,
    attachments: attachmentsData,
    isDraft:     false,
  });

  await mail.populate('sender',   'name email photo');
  await mail.populate('receiver', 'name email photo');

  console.log(`✅ [InternalMail] Email envoyé de ${req.user.id} à ${receiverId}`);

  return res.status(201).json({
    status: 'success',
    data:   { message: mail },
  });
});

/**
 * @description Recevoir un email externe depuis le webhook Zoho
 * @route POST /api/webhooks/zoho-incoming  (sans middleware JWT)
 */
exports.receiveExternalMail = asyncHandler(async (req, res) => {
  const {
    fromAddress,
    fromName,
    toAddress,
    subject,
    textContent,
    htmlContent,
    messageId,
  } = req.body;

  if (!fromAddress || !toAddress) {
    return res.status(400).json({ status: 'fail', message: 'Champs from/to manquants.' });
  }

  // Éviter les doublons
  if (messageId) {
    const existing = await InternalMail.findOne({ zohoMessageId: messageId });
    if (existing) {
      return res.status(200).json({ status: 'ignored', message: 'Email déjà reçu.' });
    }
  }

  // Trouver l'utilisateur destinataire par son adresse Zoho
  const recipientUser = await User.findOne({
    $or: [
      { email:      toAddress.toLowerCase() },
      { zohoEmail:  toAddress.toLowerCase() },
    ],
  });

  if (!recipientUser) {
    console.warn(`⚠️ [webhook] Aucun utilisateur trouvé pour : ${toAddress}`);
    // Répondre 200 pour éviter les renvois répétés de Zoho
    return res.status(200).json({ status: 'ignored', message: 'Destinataire inconnu.' });
  }

  const mail = await InternalMail.create({
    senderName:     fromName    || fromAddress,
    senderEmail:    fromAddress,
    receiver:       recipientUser._id,
    subject:        subject     || 'Sans objet',
    content:        textContent || htmlContent || '',
    priority:       'Normale',
    isRead:         false,
    isDraft:        false,
    isDeleted:      false,
    isExternalMail: true,
    zohoMessageId:  messageId || null,
  });

  console.log(`✅ [webhook] Email externe reçu et sauvegardé : ${mail._id}`);

  return res.status(200).json({
    status: 'success',
    data:   { messageId: mail._id },
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
    size:     file.size,
  }));

  const draft = await InternalMail.create({
    sender:      req.user.id,
    receiver:    receiverId || null,
    subject:     subject    || 'Sans objet',
    content:     content    || '',
    priority,
    attachments: attachmentsData,
    isDraft:     true,
  });

  await draft.populate('sender', 'name email photo');
  if (draft.receiver) await draft.populate('receiver', 'name email photo');

  res.status(201).json({
    status: 'success',
    data:   { message: draft },
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
    _id:       draftId,
    sender:    req.user.id,
    isDraft:   true,
    isDeleted: false,
  });

  if (!draft) {
    res.status(404);
    throw new Error('Brouillon non trouvé.');
  }

  if (receiverId !== undefined) draft.receiver = receiverId || null;
  if (content    !== undefined) draft.content   = content;
  if (subject    !== undefined) draft.subject   = subject;
  if (priority   !== undefined) draft.priority  = priority;

  if (uploadedFiles.length > 0) {
    const newAttachments = uploadedFiles.map(file => ({
      filename: file.originalname,
      filepath: file.path,
      mimetype: file.mimetype,
      size:     file.size,
    }));
    draft.attachments = [...draft.attachments, ...newAttachments];
  }

  await draft.save();
  await draft.populate('sender', 'name email photo');
  if (draft.receiver) await draft.populate('receiver', 'name email photo');

  res.status(200).json({
    status: 'success',
    data:   { message: draft },
  });
});

/**
 * @description Supprimer un brouillon
 */
exports.deleteDraft = asyncHandler(async (req, res) => {
  const { draftId } = req.params;
  const draft = await InternalMail.findOneAndDelete({
    _id:     draftId,
    sender:  req.user.id,
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
 * Inclut les emails externes (isExternalMail: true) reçus via webhook
 */
exports.getInbox = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    receiver:  req.user.id,
    isDraft:   false,
    isDeleted: false,
  };

  const messages = await InternalMail.find(query)
    .populate('sender',   'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

  res.status(200).json({
    status:     'success',
    results:    messages.length,
    total,
    page:       parseInt(page),
    totalPages: Math.ceil(total / limit),
    data:       { messages },
  });
});

/**
 * @description Récupérer les emails envoyés
 * Inclut les emails externes envoyés via Zoho
 */
exports.getSent = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    sender:    req.user.id,
    isDraft:   false,
    isDeleted: false,
  };

  const messages = await InternalMail.find(query)
    .populate('sender',   'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

  res.status(200).json({
    status:     'success',
    results:    messages.length,
    total,
    page:       parseInt(page),
    totalPages: Math.ceil(total / limit),
    data:       { messages },
  });
});

/**
 * @description Récupérer les emails non lus
 */
exports.getUnread = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    receiver:  req.user.id,
    isRead:    false,
    isDraft:   false,
    isDeleted: false,
  };

  const messages = await InternalMail.find(query)
    .populate('sender',   'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

  res.status(200).json({
    status:     'success',
    results:    messages.length,
    total,
    page:       parseInt(page),
    totalPages: Math.ceil(total / limit),
    data:       { messages },
  });
});

/**
 * @description Récupérer les favoris
 */
exports.getStarred = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    $or: [
      { receiver: req.user.id, isStarred: true },
      { sender:   req.user.id, isStarred: true },
    ],
    isDraft:   false,
    isDeleted: false,
  };

  const messages = await InternalMail.find(query)
    .populate('sender',   'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

  res.status(200).json({
    status:     'success',
    results:    messages.length,
    total,
    page:       parseInt(page),
    totalPages: Math.ceil(total / limit),
    data:       { messages },
  });
});

/**
 * @description Récupérer les brouillons
 */
exports.getDrafts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    sender:    req.user.id,
    isDraft:   true,
    isDeleted: false,
  };

  const messages = await InternalMail.find(query)
    .populate('receiver', 'name email photo')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

  res.status(200).json({
    status:     'success',
    results:    messages.length,
    total,
    page:       parseInt(page),
    totalPages: Math.ceil(total / limit),
    data:       { messages },
  });
});

/**
 * @description Récupérer la corbeille
 */
exports.getTrash = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    $or: [
      { receiver: req.user.id, isDeleted: true },
      { sender:   req.user.id, isDeleted: true },
    ],
  };

  const messages = await InternalMail.find(query)
    .populate('sender',   'name email photo')
    .populate('receiver', 'name email photo')
    .sort({ deletedAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await InternalMail.countDocuments(query);

  res.status(200).json({
    status:     'success',
    results:    messages.length,
    total,
    page:       parseInt(page),
    totalPages: Math.ceil(total / limit),
    data:       { messages },
  });
});

/**
 * @description Compter les emails non lus
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await InternalMail.countDocuments({
    receiver:  req.user.id,
    isRead:    false,
    isDraft:   false,
    isDeleted: false,
  });

  res.status(200).json({
    status: 'success',
    data:   { unreadCount },
  });
});

/**
 * @description Marquer un email comme lu
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);
  if (!mail) { res.status(404); throw new Error('Email non trouvé.'); }

  // Accepter aussi les emails externes (pas de sender ObjectId)
  if (mail.receiver?.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Non autorisé.');
  }

  mail.isRead = true;
  mail.readAt = Date.now();
  await mail.save();

  res.status(200).json({ status: 'success', data: { message: mail } });
});

/**
 * @description Marquer un email comme non lu
 */
exports.markAsUnread = asyncHandler(async (req, res) => {
  const mail = await InternalMail.findById(req.params.mailId);
  if (!mail) { res.status(404); throw new Error('Email non trouvé.'); }
  if (mail.receiver?.toString() !== req.user.id) { res.status(403); throw new Error('Non autorisé.'); }

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

  const isOwner =
    mail.sender?.toString()   === req.user.id ||
    mail.receiver?.toString() === req.user.id;

  if (!isOwner) { res.status(403); throw new Error('Non autorisé.'); }

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

  const isOwner =
    mail.sender?.toString()   === req.user.id ||
    mail.receiver?.toString() === req.user.id;

  if (!isOwner) { res.status(403); throw new Error('Non autorisé.'); }

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

  const isOwner =
    mail.sender?.toString()   === req.user.id ||
    mail.receiver?.toString() === req.user.id;

  if (!isOwner) { res.status(403); throw new Error('Non autorisé.'); }

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

  const isOwner =
    mail.sender?.toString()   === req.user.id ||
    mail.receiver?.toString() === req.user.id;

  if (!isOwner) { res.status(403); throw new Error('Non autorisé.'); }

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
    _id:       req.params.mailId,
    isDeleted: true,
  });

  if (!mail) { res.status(404); throw new Error('Email non trouvé dans la corbeille.'); }

  const isOwner =
    mail.sender?.toString()   === req.user.id ||
    mail.receiver?.toString() === req.user.id;

  if (!isOwner) { res.status(403); throw new Error('Non autorisé.'); }

  await InternalMail.findByIdAndDelete(req.params.mailId);
  res.status(204).json({ status: 'success', data: null });
});

/**
 * @description Vider la corbeille
 */
exports.emptyTrash = asyncHandler(async (req, res) => {
  const result = await InternalMail.deleteMany({
    $or: [
      { sender:   req.user.id, isDeleted: true },
      { receiver: req.user.id, isDeleted: true },
    ],
  });

  res.status(200).json({
    status: 'success',
    data:   { deletedCount: result.deletedCount },
  });
});