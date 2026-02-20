const Email = require('../models/Email');
const zohoMailService = require('./zohoMailService');

// Récupérer tous les emails de la base de données
const getAllEmails = async () => {
  try {
    const emails = await Email.find()
      .populate('assignedTo', 'name email') // Optimisation : ne récupérer que les champs nécessaires
      .sort({ createdAt: -1 });
    return emails;
  } catch (error) {
    console.error('❌ [EmailService] Erreur getAllEmails:', error);
    throw new Error('Erreur lors de la récupération des emails: ' + error.message);
  }
};

// Créer un nouvel email
const createEmail = async (emailData) => {
  try {
    // Vérifier si l'email existe déjà
    const existingEmail = await Email.findOne({ email: emailData.email });
    if (existingEmail) {
      throw new Error('Cet email existe déjà dans le système');
    }

    // Créer dans la base de données MongoDB
    const newEmail = new Email({
      email: emailData.email,
      displayName: emailData.displayName,
      emailType: emailData.emailType,
      description: emailData.description,
      notifications: emailData.notifications,
      assignedTo: emailData.assignedTo || null,
      isActive: true,
      emailsSent: 0
    });

    await newEmail.save();
    
    console.log(`✅ [EmailService] Email ${emailData.email} créé dans la base de données`);

    // Peupler les données de l'utilisateur assigné
    await newEmail.populate('assignedTo', 'name email');

    return newEmail;
  } catch (error) {
    console.error('❌ [EmailService] Erreur createEmail:', error);
    throw new Error('Erreur lors de la création de l\'email: ' + error.message);
  }
};

// Mettre à jour un email
const updateEmail = async (emailId, updateData) => {
  try {
    const email = await Email.findByIdAndUpdate(
      emailId,
      {
        displayName: updateData.displayName,
        emailType: updateData.emailType,
        description: updateData.description,
        notifications: updateData.notifications,
        assignedTo: updateData.assignedTo || null
      },
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email');

    if (!email) {
      throw new Error('Email non trouvé');
    }

    console.log(`✅ [EmailService] Email ${email.email} mis à jour`);
    return email;
  } catch (error) {
    console.error('❌ [EmailService] Erreur updateEmail:', error);
    throw new Error('Erreur lors de la mise à jour: ' + error.message);
  }
};

// Supprimer un email
const deleteEmail = async (emailId) => {
  try {
    const email = await Email.findByIdAndDelete(emailId);
    
    if (!email) {
      throw new Error('Email non trouvé');
    }

    console.log(`✅ [EmailService] Email ${email.email} supprimé`);
    return { message: 'Email supprimé avec succès', email: email.email };
  } catch (error) {
    console.error('❌ [EmailService] Erreur deleteEmail:', error);
    throw new Error('Erreur lors de la suppression: ' + error.message);
  }
};

// Activer/Désactiver un email
const toggleEmailStatus = async (emailId) => {
  try {
    const email = await Email.findById(emailId);
    
    if (!email) {
      throw new Error('Email non trouvé');
    }

    email.isActive = !email.isActive;
    await email.save();

    console.log(`✅ [EmailService] Statut de ${email.email} changé: ${email.isActive ? 'Actif' : 'Inactif'}`);

    await email.populate('assignedTo', 'name email');
    return email;
  } catch (error) {
    console.error('❌ [EmailService] Erreur toggleEmailStatus:', error);
    throw new Error('Erreur lors du changement de statut: ' + error.message);
  }
};

// Mettre à jour les notifications
const updateNotifications = async (emailId, notifications) => {
  try {
    const email = await Email.findByIdAndUpdate(
      emailId,
      { notifications },
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email');

    if (!email) {
      throw new Error('Email non trouvé');
    }

    console.log(`✅ [EmailService] Notifications de ${email.email} mises à jour`);
    return email;
  } catch (error) {
    console.error('❌ [EmailService] Erreur updateNotifications:', error);
    throw new Error('Erreur lors de la mise à jour des notifications: ' + error.message);
  }
};

// Obtenir les statistiques globales
const getGlobalStats = async () => {
  try {
    const emails = await Email.find();
    
    const totalEmails = emails.length;
    const activeEmails = emails.filter(e => e.isActive).length;
    const totalSent = emails.reduce((acc, e) => acc + (e.emailsSent || 0), 0);
    const withNotifications = emails.filter(e => 
      Object.values(e.notifications || {}).some(v => v === true)
    ).length;

    const stats = {
      global: {
        totalEmails,
        activeEmails,
        totalSent
      },
      withNotifications
    };

    console.log(`📊 [EmailService] Stats: ${totalEmails} emails, ${activeEmails} actifs, ${totalSent} envoyés`);
    return stats;
  } catch (error) {
    console.error('❌ [EmailService] Erreur getGlobalStats:', error);
    throw new Error('Erreur lors de la récupération des statistiques: ' + error.message);
  }
};

// Envoyer un email via Zoho
const sendEmailViaZoho = async (fromEmail, toEmail, subject, content) => {
  try {
    console.log(`📧 [EmailService] Envoi email de ${fromEmail} vers ${toEmail}`);

    // Vérifier que l'email d'envoi existe dans la base de données et est actif
    const emailAccount = await Email.findOne({ email: fromEmail, isActive: true });
    
    if (!emailAccount) {
      throw new Error('Compte email non trouvé ou inactif');
    }

    // Envoyer via Zoho Mail API
    const result = await zohoMailService.sendEmail(fromEmail, toEmail, subject, content);

    // Incrémenter le compteur d'emails envoyés
    emailAccount.emailsSent = (emailAccount.emailsSent || 0) + 1;
    emailAccount.lastEmailSent = new Date();
    await emailAccount.save();

    console.log(`✅ [EmailService] Email envoyé ! Total: ${emailAccount.emailsSent}`);

    return {
      success: true,
      message: 'Email envoyé avec succès',
      emailsSent: emailAccount.emailsSent,
      fromEmail: fromEmail,
      toEmail: toEmail,
      zohoResponse: result
    };
  } catch (error) {
    console.error('❌ [EmailService] Erreur sendEmailViaZoho:', error);
    throw new Error('Erreur lors de l\'envoi de l\'email: ' + error.message);
  }
};

// Synchroniser avec Zoho Mail
const syncWithZoho = async () => {
  try {
    console.log('🔄 [EmailService] Début de la synchronisation avec Zoho...');

    const zohoAccounts = await zohoMailService.getAllAccounts();
    
    const syncResults = {
      total: zohoAccounts.length,
      synced: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const zohoAccount of zohoAccounts) {
      try {
        // Vérifier si l'email existe déjà dans la base de données
        let email = await Email.findOne({ email: zohoAccount.primaryEmailAddress });
        
        if (!email) {
          // Créer un nouvel enregistrement
          email = new Email({
            email: zohoAccount.primaryEmailAddress,
            displayName: zohoAccount.displayName,
            emailType: zohoAccount.role === 'super_admin' ? 'Administration' : 'Personnel',
            description: 'Synchronisé depuis Zoho Mail',
            isActive: zohoAccount.status,
            zohoAccountId: zohoAccount.accountId,
            emailsSent: 0
          });
          
          await email.save();
          syncResults.synced++;
          console.log(`✅ [EmailService] Nouveau compte synchronisé: ${zohoAccount.primaryEmailAddress}`);
        } else {
          // Mettre à jour les informations si nécessaire
          let updated = false;
          
          if (email.zohoAccountId !== zohoAccount.accountId) {
            email.zohoAccountId = zohoAccount.accountId;
            updated = true;
          }
          
          if (email.isActive !== zohoAccount.status) {
            email.isActive = zohoAccount.status;
            updated = true;
          }
          
          if (updated) {
            await email.save();
            syncResults.updated++;
            console.log(`🔄 [EmailService] Compte mis à jour: ${zohoAccount.primaryEmailAddress}`);
          } else {
            syncResults.skipped++;
          }
        }
      } catch (err) {
        syncResults.errors.push({
          email: zohoAccount.primaryEmailAddress,
          error: err.message
        });
        console.error(`❌ [EmailService] Erreur sync pour ${zohoAccount.primaryEmailAddress}:`, err.message);
      }
    }

    console.log(`✅ [EmailService] Synchronisation terminée: ${syncResults.synced} créés, ${syncResults.updated} mis à jour, ${syncResults.skipped} ignorés`);
    return syncResults;
  } catch (error) {
    console.error('❌ [EmailService] Erreur syncWithZoho:', error);
    throw new Error('Erreur lors de la synchronisation: ' + error.message);
  }
};

// Envoyer un email de notification (pour usage interne)
const sendNotificationEmail = async (emailType, recipientEmail, data) => {
  try {
    // Trouver le compte email approprié selon le type
    const emailAccount = await Email.findOne({ 
      emailType: emailType, 
      isActive: true 
    });

    if (!emailAccount) {
      console.warn(`⚠️ [EmailService] Aucun compte actif trouvé pour le type: ${emailType}`);
      return null;
    }

    // Construire le contenu de l'email selon le type
    let subject = '';
    let content = '';

    switch (emailType) {
      case 'Contact Général':
        subject = `Nouveau message de contact - ${data.senderName}`;
        content = `
          <html>
            <body style="font-family: Arial; padding: 20px;">
              <h2>Nouveau message de contact</h2>
              <p><strong>De:</strong> ${data.senderName} (${data.senderEmail})</p>
              <p><strong>Sujet:</strong> ${data.subject}</p>
              <p><strong>Message:</strong></p>
              <p>${data.message}</p>
            </body>
          </html>
        `;
        break;

      case 'Devis & Commercial':
        subject = `Nouvelle demande de devis - ${data.clientName}`;
        content = `
          <html>
            <body style="font-family: Arial; padding: 20px;">
              <h2>Nouvelle demande de devis</h2>
              <p><strong>Client:</strong> ${data.clientName}</p>
              <p><strong>Service:</strong> ${data.service}</p>
              <p><strong>Détails:</strong> ${data.details}</p>
            </body>
          </html>
        `;
        break;

      default:
        subject = `Notification - ${emailType}`;
        content = `
          <html>
            <body style="font-family: Arial; padding: 20px;">
              <h2>Notification</h2>
              <p>${JSON.stringify(data)}</p>
            </body>
          </html>
        `;
    }

    return await sendEmailViaZoho(emailAccount.email, recipientEmail, subject, content);
  } catch (error) {
    console.error('❌ [EmailService] Erreur sendNotificationEmail:', error);
    throw new Error('Erreur lors de l\'envoi de la notification: ' + error.message);
  }
};

// Obtenir un email par son adresse
const getEmailByAddress = async (emailAddress) => {
  try {
    const email = await Email.findOne({ email: emailAddress })
      .populate('assignedTo', 'name email');
    
    if (!email) {
      throw new Error('Email non trouvé');
    }

    return email;
  } catch (error) {
    console.error('❌ [EmailService] Erreur getEmailByAddress:', error);
    throw new Error('Erreur lors de la récupération de l\'email: ' + error.message);
  }
};

module.exports = {
  getAllEmails,
  createEmail,
  updateEmail,
  deleteEmail,
  toggleEmailStatus,
  updateNotifications,
  getGlobalStats,
  sendEmailViaZoho,
  syncWithZoho,
  sendNotificationEmail,
  getEmailByAddress
};