// controllers/emailController.js

const Email = require('../models/emailModel');

/**
 * @desc    Récupérer tous les emails
 * @route   GET /api/emails
 * @access  Private/Admin
 */
exports.getAllEmails = async (req, res) => {
  try {
    const emails = await Email.find().populate('assignedTo', 'name email');
    res.status(200).json({
      status: 'success',
      results: emails.length,
      data: emails
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Récupérer uniquement les emails actifs
 * @route   GET /api/emails/active
 * @access  Private
 */
exports.getActiveEmails = async (req, res) => {
  try {
    const emails = await Email.find({ isActive: true }).populate('assignedTo', 'name email');
    res.status(200).json({
      status: 'success',
      results: emails.length,
      data: emails
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Récupérer les statistiques globales
 * @route   GET /api/emails/stats/global
 * @access  Private/Admin
 */
exports.getGlobalStats = async (req, res) => {
  try {
    const total = await Email.countDocuments();
    const actifs = await Email.countDocuments({ isActive: true });
    const inactifs = total - actifs;

    // Répartition par type
    const parType = await Email.aggregate([
      { $group: { _id: '$emailType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Total emails envoyés
    const statsEnvoi = await Email.aggregate([
      { $group: { _id: null, totalEnvoyes: { $sum: '$emailsSent' } } }
    ]);

    // Notifications activées
    const notifQuotes = await Email.countDocuments({ 'notifications.quotes': true });
    const notifContact = await Email.countDocuments({ 'notifications.contactMessages': true });
    const notifEvents = await Email.countDocuments({ 'notifications.events': true });
    const notifProperties = await Email.countDocuments({ 'notifications.properties': true });

    res.status(200).json({
      status: 'success',
      data: {
        total,
        actifs,
        inactifs,
        totalEmailsEnvoyes: statsEnvoi[0]?.totalEnvoyes || 0,
        parType,
        notifications: {
          devis: notifQuotes,
          contact: notifContact,
          evenements: notifEvents,
          proprietes: notifProperties
        }
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Récupérer les emails pour notifications de devis
 * @route   GET /api/emails/notifications/quotes
 * @access  Private
 */
exports.getQuoteNotificationEmails = async (req, res) => {
  try {
    const emails = await Email.find({ 'notifications.quotes': true, isActive: true });
    res.status(200).json({ status: 'success', data: emails });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Récupérer les emails pour notifications de contact
 * @route   GET /api/emails/notifications/contact
 * @access  Private
 */
exports.getContactNotificationEmails = async (req, res) => {
  try {
    const emails = await Email.find({ 'notifications.contactMessages': true, isActive: true });
    res.status(200).json({ status: 'success', data: emails });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Récupérer les emails d'un utilisateur
 * @route   GET /api/emails/user/:userId
 * @access  Private/Admin
 */
exports.getEmailsByUser = async (req, res) => {
  try {
    const emails = await Email.find({ assignedTo: req.params.userId });
    res.status(200).json({ status: 'success', data: emails });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Récupérer un email par ID
 * @route   GET /api/emails/:id
 * @access  Private/Admin
 */
exports.getEmailById = async (req, res) => {
  try {
    const email = await Email.findById(req.params.id).populate('assignedTo', 'name email');
    if (!email) {
      return res.status(404).json({ status: 'fail', message: 'Email non trouvé' });
    }
    res.status(200).json({ status: 'success', data: email });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Créer un nouvel email
 * @route   POST /api/emails
 * @access  Private/Admin
 */
exports.createEmail = async (req, res) => {
  try {
    const email = await Email.create(req.body);
    res.status(201).json({ status: 'success', data: email });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ status: 'fail', message: 'Cet email existe déjà' });
    }
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * @desc    Mettre à jour un email
 * @route   PUT /api/emails/:id
 * @access  Private/Admin
 */
exports.updateEmail = async (req, res) => {
  try {
    const email = await Email.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!email) {
      return res.status(404).json({ status: 'fail', message: 'Email non trouvé' });
    }
    res.status(200).json({ status: 'success', data: email });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * @desc    Supprimer un email
 * @route   DELETE /api/emails/:id
 * @access  Private/Admin
 */
exports.deleteEmail = async (req, res) => {
  try {
    const email = await Email.findByIdAndDelete(req.params.id);
    if (!email) {
      return res.status(404).json({ status: 'fail', message: 'Email non trouvé' });
    }
    res.status(200).json({ status: 'success', message: 'Email supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Activer / Désactiver un email
 * @route   PATCH /api/emails/:id/toggle
 * @access  Private/Admin
 */
exports.toggleEmailStatus = async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);
    if (!email) {
      return res.status(404).json({ status: 'fail', message: 'Email non trouvé' });
    }
    email.isActive = !email.isActive;
    await email.save();
    res.status(200).json({ status: 'success', data: email });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Mettre à jour les notifications d'un email
 * @route   PATCH /api/emails/:id/notifications
 * @access  Private/Admin
 */
exports.updateNotifications = async (req, res) => {
  try {
    const { notifications } = req.body;
    const email = await Email.findByIdAndUpdate(
      req.params.id,
      { notifications },
      { new: true, runValidators: true }
    );
    if (!email) {
      return res.status(404).json({ status: 'fail', message: 'Email non trouvé' });
    }
    res.status(200).json({ status: 'success', data: email });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * @desc    Envoyer un email via Zoho Mail
 * @route   POST /api/emails/send
 * @access  Private
 */
exports.sendEmailViaZoho = async (req, res) => {
  try {
    const { fromEmail, toEmail, subject, content } = req.body;

    if (!fromEmail || !toEmail || !subject || !content) {
      return res.status(400).json({
        status: 'fail',
        message: 'Champs requis manquants: fromEmail, toEmail, subject, content'
      });
    }

    // Vérifier que fromEmail existe dans la DB et est actif
    const emailDoc = await Email.findOne({ email: fromEmail, isActive: true });
    if (!emailDoc) {
      return res.status(404).json({
        status: 'fail',
        message: `L'email expéditeur ${fromEmail} n'existe pas ou est inactif`
      });
    }

    // TODO: Intégrer l'API Zoho Mail ici
    // const zoho = require('../utils/zohoMailer');
    // await zoho.send({ from: fromEmail, to: toEmail, subject, html: content });

    // Mettre à jour le compteur d'envois
    await Email.findByIdAndUpdate(emailDoc._id, {
      $inc: { emailsSent: 1 },
      lastEmailSent: new Date()
    });

    res.status(200).json({
      status: 'success',
      message: `Email envoyé de ${fromEmail} vers ${toEmail}`,
      data: { fromEmail, toEmail, subject, sentAt: new Date() }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Synchroniser avec Zoho Mail
 * @route   POST /api/emails/sync-zoho
 * @access  Private/Admin
 */
exports.syncWithZoho = async (req, res) => {
  try {
    // TODO: Intégrer la synchronisation Zoho ici
    // const zoho = require('../utils/zohoMailer');
    // const accounts = await zoho.listAccounts();

    res.status(200).json({
      status: 'success',
      message: 'Synchronisation Zoho effectuée (stub)',
      data: { syncedAt: new Date(), accountsSynced: 0 }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};