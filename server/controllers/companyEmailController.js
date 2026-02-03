// server/controllers/companyEmailController.js
const CompanyEmail = require('../models/CompanyEmail');
const asyncHandler = require('express-async-handler');

/* ======================================================
   📋 RÉCUPÉRER TOUS LES EMAILS
====================================================== */
exports.getAllEmails = asyncHandler(async (req, res) => {
  const emails = await CompanyEmail.find()
    .populate('assignedTo', 'name email role photo')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: emails.length,
    data: { emails },
  });
});

/* ======================================================
   📋 RÉCUPÉRER LES EMAILS ACTIFS
====================================================== */
exports.getActiveEmails = asyncHandler(async (req, res) => {
  const emails = await CompanyEmail.getActiveEmails();

  res.status(200).json({
    status: 'success',
    results: emails.length,
    data: { emails },
  });
});

/* ======================================================
   🔍 RÉCUPÉRER UN EMAIL PAR ID
====================================================== */
exports.getEmailById = asyncHandler(async (req, res) => {
  const email = await CompanyEmail.findById(req.params.id)
    .populate('assignedTo', 'name email role photo')
    .populate('createdBy', 'name email');

  if (!email) {
    res.status(404);
    throw new Error('Email professionnel introuvable');
  }

  res.status(200).json({
    status: 'success',
    data: { email },
  });
});

/* ======================================================
   ➕ CRÉER UN NOUVEL EMAIL
====================================================== */
exports.createEmail = asyncHandler(async (req, res) => {
  const {
    email,
    displayName,
    emailType,
    description,
    assignedTo,
    notifications,
    password,
    smtpConfig,
  } = req.body;

  // Vérifier si l'email existe déjà
  const emailExists = await CompanyEmail.emailExists(email);
  if (emailExists) {
    res.status(400);
    throw new Error('Cette adresse email existe déjà');
  }

  // Vérifier le format de l'email
  if (!email.endsWith('@altitudevision.cg')) {
    res.status(400);
    throw new Error('L\'adresse doit se terminer par @altitudevision.cg');
  }

  // Créer l'email
  const newEmail = await CompanyEmail.create({
    email,
    displayName,
    emailType,
    description,
    assignedTo: assignedTo || null,
    notifications: notifications || {},
    password,
    smtpConfig,
    createdBy: req.user._id,
  });

  // Peupler les champs
  await newEmail.populate('assignedTo', 'name email role photo');
  await newEmail.populate('createdBy', 'name email');

  res.status(201).json({
    status: 'success',
    message: '✅ Email professionnel créé avec succès',
    data: { email: newEmail },
  });
});

/* ======================================================
   ✏️ METTRE À JOUR UN EMAIL
====================================================== */
exports.updateEmail = asyncHandler(async (req, res) => {
  const {
    displayName,
    emailType,
    description,
    assignedTo,
    notifications,
    isActive,
    password,
    smtpConfig,
  } = req.body;

  const email = await CompanyEmail.findById(req.params.id);

  if (!email) {
    res.status(404);
    throw new Error('Email professionnel introuvable');
  }

  // Mise à jour des champs
  if (displayName !== undefined) email.displayName = displayName;
  if (emailType !== undefined) email.emailType = emailType;
  if (description !== undefined) email.description = description;
  if (assignedTo !== undefined) email.assignedTo = assignedTo || null;
  if (notifications !== undefined) email.notifications = { ...email.notifications, ...notifications };
  if (isActive !== undefined) email.isActive = isActive;
  if (password !== undefined) email.password = password;
  if (smtpConfig !== undefined) email.smtpConfig = { ...email.smtpConfig, ...smtpConfig };

  await email.save();

  // Peupler les champs
  await email.populate('assignedTo', 'name email role photo');
  await email.populate('createdBy', 'name email');

  res.status(200).json({
    status: 'success',
    message: '✅ Email mis à jour avec succès',
    data: { email },
  });
});

/* ======================================================
   🗑️ SUPPRIMER UN EMAIL
====================================================== */
exports.deleteEmail = asyncHandler(async (req, res) => {
  const email = await CompanyEmail.findById(req.params.id);

  if (!email) {
    res.status(404);
    throw new Error('Email professionnel introuvable');
  }

  await email.deleteOne();

  res.status(200).json({
    status: 'success',
    message: '✅ Email supprimé avec succès',
    data: null,
  });
});

/* ======================================================
   🔄 ACTIVER/DÉSACTIVER UN EMAIL
====================================================== */
exports.toggleEmailStatus = asyncHandler(async (req, res) => {
  const email = await CompanyEmail.findById(req.params.id);

  if (!email) {
    res.status(404);
    throw new Error('Email professionnel introuvable');
  }

  email.isActive = !email.isActive;
  await email.save();

  await email.populate('assignedTo', 'name email role photo');

  res.status(200).json({
    status: 'success',
    message: `✅ Email ${email.isActive ? 'activé' : 'désactivé'} avec succès`,
    data: { email },
  });
});

/* ======================================================
   🔔 METTRE À JOUR LES NOTIFICATIONS
====================================================== */
exports.updateNotifications = asyncHandler(async (req, res) => {
  const { notifications } = req.body;

  const email = await CompanyEmail.findById(req.params.id);

  if (!email) {
    res.status(404);
    throw new Error('Email professionnel introuvable');
  }

  // Fusionner les nouvelles notifications
  email.notifications = { ...email.notifications, ...notifications };
  await email.save();

  await email.populate('assignedTo', 'name email role photo');

  res.status(200).json({
    status: 'success',
    message: '✅ Notifications mises à jour avec succès',
    data: { email },
  });
});

/* ======================================================
   📊 RÉCUPÉRER LES STATISTIQUES GLOBALES
====================================================== */
exports.getGlobalStats = asyncHandler(async (req, res) => {
  const stats = await CompanyEmail.getGlobalStats();

  // Statistiques par type
  const byType = await CompanyEmail.aggregate([
    {
      $group: {
        _id: '$emailType',
        count: { $sum: 1 },
      },
    },
  ]);

  // Emails avec notifications actives
  const withNotifications = await CompanyEmail.countDocuments({
    $or: [
      { 'notifications.quotes': true },
      { 'notifications.contactMessages': true },
      { 'notifications.systemAlerts': true },
      { 'notifications.properties': true },
      { 'notifications.events': true },
    ],
    isActive: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      global: stats,
      byType,
      withNotifications,
    },
  });
});

/* ======================================================
   📧 RÉCUPÉRER LES EMAILS POUR NOTIFICATIONS DEVIS
====================================================== */
exports.getQuoteNotificationEmails = asyncHandler(async (req, res) => {
  const emails = await CompanyEmail.getQuoteNotificationEmails();

  res.status(200).json({
    status: 'success',
    results: emails.length,
    data: { emails },
  });
});

/* ======================================================
   📧 RÉCUPÉRER LES EMAILS POUR NOTIFICATIONS CONTACT
====================================================== */
exports.getContactNotificationEmails = asyncHandler(async (req, res) => {
  const emails = await CompanyEmail.getContactNotificationEmails();

  res.status(200).json({
    status: 'success',
    results: emails.length,
    data: { emails },
  });
});

/* ======================================================
   👤 RÉCUPÉRER LES EMAILS D'UN COLLABORATEUR
====================================================== */
exports.getEmailsByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const emails = await CompanyEmail.getAssignedTo(userId);

  res.status(200).json({
    status: 'success',
    results: emails.length,
    data: { emails },
  });
});

/* ======================================================
   📈 INCRÉMENTER LES STATISTIQUES D'ENVOI
====================================================== */
exports.incrementSent = asyncHandler(async (req, res) => {
  const email = await CompanyEmail.findById(req.params.id);

  if (!email) {
    res.status(404);
    throw new Error('Email professionnel introuvable');
  }

  await email.incrementSent();

  res.status(200).json({
    status: 'success',
    message: '✅ Statistiques mises à jour',
    data: { email },
  });
});

/* ======================================================
   📈 INCRÉMENTER LES STATISTIQUES DE RÉCEPTION
====================================================== */
exports.incrementReceived = asyncHandler(async (req, res) => {
  const email = await CompanyEmail.findById(req.params.id);

  if (!email) {
    res.status(404);
    throw new Error('Email professionnel introuvable');
  }

  await email.incrementReceived();

  res.status(200).json({
    status: 'success',
    message: '✅ Statistiques mises à jour',
    data: { email },
  });
});