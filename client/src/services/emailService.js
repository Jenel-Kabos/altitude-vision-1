// src/services/emailService.js
import api from './api';

/**
 * @description Récupérer tous les emails professionnels
 * @returns {Promise<Array>} - Liste de tous les emails
 */
export const getAllEmails = async () => {
  try {
    console.log("📤 [emailService] Chargement des emails...");
    const response = await api.get('/emails');
    console.log("✅ [emailService] Emails chargés:", response.data.length);
    return response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur lors du chargement des emails:", error);
    throw error;
  }
};

/**
 * @description Récupérer uniquement les emails actifs
 * @returns {Promise<Array>} - Liste des emails actifs
 */
export const getActiveEmails = async () => {
  try {
    const response = await api.get('/emails/active');
    console.log("✅ [emailService] Emails actifs chargés:", response.data.length);
    return response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur:", error);
    throw error;
  }
};

/**
 * @description Récupérer un email par son ID
 * @param {string} emailId - L'identifiant de l'email
 * @returns {Promise<Object>} - Détails de l'email
 */
export const getEmailById = async (emailId) => {
  try {
    const response = await api.get(`/emails/${emailId}`);
    console.log(`✅ [emailService] Email ${emailId} chargé`);
    return response.data;
  } catch (error) {
    console.error(`❌ [emailService] Erreur lors du chargement de l'email ${emailId}:`, error);
    throw error;
  }
};

/**
 * @description Créer un nouvel email professionnel
 * @param {Object} emailData - Les données de l'email
 * @returns {Promise<Object>} - Email créé
 */
export const createEmail = async (emailData) => {
  try {
    console.log("📤 [emailService] Création d'un nouvel email:", emailData);
    const response = await api.post('/emails', emailData);
    console.log("✅ [emailService] Email créé avec succès");
    return response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur lors de la création:", error);
    throw error;
  }
};

/**
 * @description Mettre à jour un email
 * @param {string} emailId - L'identifiant de l'email
 * @param {Object} emailData - Les nouvelles données
 * @returns {Promise<Object>} - Email mis à jour
 */
export const updateEmail = async (emailId, emailData) => {
  try {
    console.log(`📤 [emailService] Mise à jour de l'email ${emailId}`);
    const response = await api.put(`/emails/${emailId}`, emailData);
    console.log("✅ [emailService] Email mis à jour avec succès");
    return response.data;
  } catch (error) {
    console.error(`❌ [emailService] Erreur lors de la mise à jour de l'email ${emailId}:`, error);
    throw error;
  }
};

/**
 * @description Supprimer un email
 * @param {string} emailId - L'identifiant de l'email
 * @returns {Promise<void>}
 */
export const deleteEmail = async (emailId) => {
  try {
    console.log(`🗑️ [emailService] Suppression de l'email ${emailId}`);
    await api.delete(`/emails/${emailId}`);
    console.log("✅ [emailService] Email supprimé avec succès");
  } catch (error) {
    console.error(`❌ [emailService] Erreur lors de la suppression de l'email ${emailId}:`, error);
    throw error;
  }
};

/**
 * @description Activer/Désactiver un email
 * @param {string} emailId - L'identifiant de l'email
 * @returns {Promise<Object>} - Email mis à jour
 */
export const toggleEmailStatus = async (emailId) => {
  try {
    console.log(`📤 [emailService] Basculement du statut de l'email ${emailId}`);
    const response = await api.patch(`/emails/${emailId}/toggle`);
    console.log("✅ [emailService] Statut mis à jour");
    return response.data;
  } catch (error) {
    console.error(`❌ [emailService] Erreur lors du changement de statut:`, error);
    throw error;
  }
};

/**
 * @description Mettre à jour les notifications d'un email
 * @param {string} emailId - L'identifiant de l'email
 * @param {Object} notifications - Configuration des notifications
 * @returns {Promise<Object>} - Email mis à jour
 */
export const updateNotifications = async (emailId, notifications) => {
  try {
    console.log(`📤 [emailService] Mise à jour des notifications de l'email ${emailId}`);
    const response = await api.patch(`/emails/${emailId}/notifications`, { notifications });
    console.log("✅ [emailService] Notifications mises à jour");
    return response.data;
  } catch (error) {
    console.error(`❌ [emailService] Erreur lors de la mise à jour des notifications:`, error);
    throw error;
  }
};

/**
 * @description Récupérer les statistiques globales
 * @returns {Promise<Object>} - Statistiques
 */
export const getGlobalStats = async () => {
  try {
    const response = await api.get('/emails/stats/global');
    console.log("✅ [emailService] Statistiques chargées");
    return response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur lors du chargement des statistiques:", error);
    throw error;
  }
};

/**
 * @description Récupérer les emails recevant les notifications de devis
 * @returns {Promise<Array>} - Liste des emails
 */
export const getQuoteNotificationEmails = async () => {
  try {
    const response = await api.get('/emails/notifications/quotes');
    return response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur:", error);
    throw error;
  }
};

/**
 * @description Récupérer les emails recevant les notifications de contact
 * @returns {Promise<Array>} - Liste des emails
 */
export const getContactNotificationEmails = async () => {
  try {
    const response = await api.get('/emails/notifications/contact');
    return response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur:", error);
    throw error;
  }
};

/**
 * @description Récupérer les emails d'un collaborateur
 * @param {string} userId - L'identifiant du collaborateur
 * @returns {Promise<Array>} - Liste des emails
 */
export const getEmailsByUser = async (userId) => {
  try {
    const response = await api.get(`/emails/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur:", error);
    throw error;
  }
};

/**
 * ✅ NOUVELLE FONCTION
 * @description Envoyer un email via Zoho Mail
 * @param {string} fromEmail - Email expéditeur
 * @param {string} toEmail - Email destinataire
 * @param {string} subject - Sujet de l'email
 * @param {string} content - Contenu HTML de l'email
 * @returns {Promise<Object>} - Résultat de l'envoi
 */
export const sendEmailViaZoho = async (fromEmail, toEmail, subject, content) => {
  try {
    console.log(`📤 [emailService] Envoi d'un email de ${fromEmail} vers ${toEmail}`);
    const response = await api.post('/emails/send', {
      fromEmail,
      toEmail,
      subject,
      content
    });
    console.log("✅ [emailService] Email envoyé avec succès");
    return response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur lors de l'envoi de l'email:", error);
    throw new Error(error.response?.data?.message || 'Erreur lors de l\'envoi de l\'email');
  }
};

/**
 * ✅ NOUVELLE FONCTION
 * @description Synchroniser les emails avec Zoho Mail
 * @returns {Promise<Object>} - Résultats de la synchronisation
 */
export const syncWithZoho = async () => {
  try {
    console.log("📤 [emailService] Synchronisation avec Zoho Mail...");
    const response = await api.post('/emails/sync-zoho');
    console.log("✅ [emailService] Synchronisation réussie");
    return response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur lors de la synchronisation:", error);
    throw new Error(error.response?.data?.message || 'Erreur lors de la synchronisation');
  }
};