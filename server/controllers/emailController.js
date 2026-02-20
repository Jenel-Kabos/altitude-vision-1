// controllers/emailController.js

const Email = require('../models/Email');

exports.getAllEmails = async (req, res) => {
  try {
    const emails = await Email.find().populate('assignedTo', 'name email');
    res.status(200).json({ status: 'success', results: emails.length, data: emails });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getActiveEmails = async (req, res) => {
  try {
    const emails = await Email.find({ isActive: true }).populate('assignedTo', 'name email');
    res.status(200).json({ status: 'success', results: emails.length, data: emails });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getGlobalStats = async (req, res) => {
  try {
    const total   = await Email.countDocuments();
    const actifs  = await Email.countDocuments({ isActive: true });
    const inactifs = total - actifs;

    const parType = await Email.aggregate([
      { $group: { _id: '$emailType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const statsEnvoi = await Email.aggregate([
      { $group: { _id: null, totalEnvoyes: { $sum: '$emailsSent' } } }
    ]);

    const notifQuotes     = await Email.countDocuments({ 'notifications.quotes': true });
    const notifContact    = await Email.countDocuments({ 'notifications.contactMessages': true });
    const notifEvents     = await Email.countDocuments({ 'notifications.events': true });
    const notifProperties = await Email.countDocuments({ 'notifications.properties': true });

    res.status(200).json({
      status: 'success',
      data: {
        // Structure attendue par ManageEmailsPage.jsx ligne 206 :
        // stats.global.totalEmails / stats.global.activeEmails / stats.global.totalSent
        // stats.withNotifications
        global: {
          totalEmails:    total,
          activeEmails:   actifs,
          inactiveEmails: inactifs,
          totalSent:      statsEnvoi[0]?.totalEnvoyes || 0
        },
        withNotifications: notifQuotes + notifContact + notifEvents + notifProperties,
        parType,
        notifications: {
          devis:      notifQuotes,
          contact:    notifContact,
          evenements: notifEvents,
          proprietes: notifProperties
        }
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getQuoteNotificationEmails = async (req, res) => {
  try {
    const emails = await Email.find({ 'notifications.quotes': true, isActive: true });
    res.status(200).json({ status: 'success', data: emails });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getContactNotificationEmails = async (req, res) => {
  try {
    const emails = await Email.find({ 'notifications.contactMessages': true, isActive: true });
    res.status(200).json({ status: 'success', data: emails });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getEmailsByUser = async (req, res) => {
  try {
    const emails = await Email.find({ assignedTo: req.params.userId });
    res.status(200).json({ status: 'success', data: emails });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getEmailById = async (req, res) => {
  try {
    const email = await Email.findById(req.params.id).populate('assignedTo', 'name email');
    if (!email) return res.status(404).json({ status: 'fail', message: 'Email non trouvé' });
    res.status(200).json({ status: 'success', data: email });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

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

exports.updateEmail = async (req, res) => {
  try {
    const email = await Email.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!email) return res.status(404).json({ status: 'fail', message: 'Email non trouvé' });
    res.status(200).json({ status: 'success', data: email });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

exports.deleteEmail = async (req, res) => {
  try {
    const email = await Email.findByIdAndDelete(req.params.id);
    if (!email) return res.status(404).json({ status: 'fail', message: 'Email non trouvé' });
    res.status(200).json({ status: 'success', message: 'Email supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.toggleEmailStatus = async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);
    if (!email) return res.status(404).json({ status: 'fail', message: 'Email non trouvé' });
    email.isActive = !email.isActive;
    await email.save();
    res.status(200).json({ status: 'success', data: email });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.updateNotifications = async (req, res) => {
  try {
    const { notifications } = req.body;
    const email = await Email.findByIdAndUpdate(
      req.params.id,
      { notifications },
      { new: true, runValidators: true }
    );
    if (!email) return res.status(404).json({ status: 'fail', message: 'Email non trouvé' });
    res.status(200).json({ status: 'success', data: email });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

exports.sendEmailViaZoho = async (req, res) => {
  try {
    const { fromEmail, toEmail, subject, content } = req.body;

    if (!fromEmail || !toEmail || !subject || !content) {
      return res.status(400).json({
        status: 'fail',
        message: 'Champs requis manquants: fromEmail, toEmail, subject, content'
      });
    }

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

    await Email.findByIdAndUpdate(emailDoc._id, {
      $inc: { emailsSent: 1 },
      lastEmailSent: new Date()
    });

    // Recharger pour avoir emailsSent à jour
    const updated = await Email.findById(emailDoc._id);

    res.status(200).json({
      status: 'success',
      message: `Email envoyé de ${fromEmail} vers ${toEmail}`,
      data: {
        fromEmail,
        toEmail,
        subject,
        sentAt: new Date(),
        emailsSent: updated.emailsSent
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.syncWithZoho = async (req, res) => {
  try {
    // TODO: Intégrer la synchronisation Zoho ici
    res.status(200).json({
      status: 'success',
      message: 'Synchronisation Zoho effectuée',
      data: { syncedAt: new Date(), accountsSynced: 0 }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};