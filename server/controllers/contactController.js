const asyncHandler = require('express-async-handler');
const ContactMessage = require('../models/ContactMessage');
const sendEmail = require('../utils/email');
const logger = require('../utils/logger');

/**
 * @description Créer un nouveau message de contact
 * @route POST /api/contact
 * @access Public
 */
exports.createContactMessage = asyncHandler(async (req, res) => {
  logger.info('📥 [Contact] Réception d\'un nouveau message:', req.body);

  const { name, email, subject, message } = req.body;

  // Validation
  if (!name || !email || !subject || !message) {
    res.status(400);
    throw new Error('Veuillez remplir tous les champs.');
  }

  // Validation de la longueur du message
  if (message.length > 2000) {
    res.status(400);
    throw new Error('Le message ne peut pas dépasser 2000 caractères.');
  }

  // Récupérer l'IP et le User-Agent
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');

  // Créer le message
  const contactMessage = await ContactMessage.create({
    name,
    email,
    subject,
    message,
    phone: req.body.phone,
    ipAddress,
    userAgent,
  });

  logger.success('✅ [Contact] Message créé avec succès:', contactMessage._id);

  // Email de notification à l'agence — best-effort : un échec d'envoi ne doit
  // pas faire échouer la requête, le message est déjà persisté en base.
  try {
    await sendEmail({
      email:   process.env.ZOHO_FROM_EMAIL || 'support@altitudevision.agency',
      subject: `📩 Nouveau message de contact — ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1A5A8A, #2E7BB5); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">📩 Nouveau message de contact</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p><strong>${name}</strong> (<a href="mailto:${email}">${email}</a>) a envoyé un message :</p>
            <p style="color: #6b7280; font-size: 13px;"><strong>Sujet :</strong> ${subject}</p>
            <blockquote style="border-left: 4px solid #2E7BB5; margin: 16px 0; padding: 8px 16px; color: #374151; background: #f8fafc;">
              ${message}
            </blockquote>
          </div>
        </div>
      `,
    });
  } catch (err) {
    logger.error('❌ [Contact] Échec de l\'email de notification (message conservé):', err.message);
  }

  res.status(201).json({
    status: 'success',
    message: 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
    data: {
      contactMessage: {
        id: contactMessage._id,
        name: contactMessage.name,
        email: contactMessage.email,
        subject: contactMessage.subject,
        submittedAt: contactMessage.submittedAt,
      },
    },
  });
});

/**
 * @description Obtenir tous les messages de contact (Admin)
 * @route GET /api/contact
 * @access Protected (Admin)
 */
exports.getAllContactMessages = asyncHandler(async (req, res) => {
  const { status, limit = 50, page = 1 } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  }

  const skip = (page - 1) * limit;

  const messages = await ContactMessage.find(filter)
    .sort({ submittedAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await ContactMessage.countDocuments(filter);

  logger.success(`✅ [Contact] ${messages.length} messages récupérés`);

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
 * @description Obtenir un message par ID (Admin)
 * @route GET /api/contact/:id
 * @access Protected (Admin)
 */
exports.getContactMessageById = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('Message non trouvé.');
  }

  // Marquer comme lu si c'est la première fois
  if (message.status === 'Non lu') {
    message.status = 'Lu';
    await message.save();
  }

  logger.success(`✅ [Contact] Message récupéré: ${message._id}`);

  res.status(200).json({
    status: 'success',
    data: {
      message,
    },
  });
});

/**
 * @description Mettre à jour le statut d'un message (Admin)
 * @route PATCH /api/contact/:id/status
 * @access Protected (Admin)
 */
exports.updateMessageStatus = asyncHandler(async (req, res) => {
  const { status, responseNote } = req.body;

  if (!status) {
    res.status(400);
    throw new Error('Le statut est requis.');
  }

  const updateData = { status };

  if (responseNote) {
    updateData.responseNote = responseNote;
  }

  if (status === 'Traité') {
    updateData.respondedAt = Date.now();
  }

  const message = await ContactMessage.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!message) {
    res.status(404);
    throw new Error('Message non trouvé.');
  }

  logger.success(`✅ [Contact] Statut du message ${message._id} mis à jour: ${status}`);

  res.status(200).json({
    status: 'success',
    message: 'Statut mis à jour avec succès',
    data: {
      message,
    },
  });
});

/**
 * @description Supprimer un message (Admin)
 * @route DELETE /api/contact/:id
 * @access Protected (Admin)
 */
exports.deleteContactMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findByIdAndDelete(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('Message non trouvé.');
  }

  logger.success(`✅ [Contact] Message supprimé: ${message._id}`);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

/**
 * @description Obtenir les statistiques des messages (Admin)
 * @route GET /api/contact/stats
 * @access Protected (Admin)
 */
exports.getContactStats = asyncHandler(async (req, res) => {
  const stats = await ContactMessage.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const totalMessages = await ContactMessage.countDocuments();
  const messagesThisMonth = await ContactMessage.countDocuments({
    submittedAt: {
      $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    },
  });

  const formattedStats = {
    total: totalMessages,
    thisMonth: messagesThisMonth,
    byStatus: stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {}),
  };

  logger.success('✅ [Contact] Statistiques récupérées');

  res.status(200).json({
    status: 'success',
    data: {
      stats: formattedStats,
    },
  });
});