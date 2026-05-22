// src/services/emailService.js
import api from './api';

/**
 * @description Récupérer tous les emails professionnels
 */
export const getAllEmails = async () => {
  try {
    const response = await api.get('/emails');
    // Le backend renvoie { status, results, data: [...] }
    const emails = response.data?.data || response.data || [];
    return emails;
  } catch (error) {
    console.error("❌ [emailService] Erreur lors du chargement des emails:", error);
    throw error;
  }
};

/**
 * @description Récupérer uniquement les emails actifs
 */
export const getActiveEmails = async () => {
  try {
    const response = await api.get('/emails/active');
    const emails = response.data?.data || response.data || [];
    return emails;
  } catch (error) {
    console.error("❌ [emailService] Erreur:", error);
    throw error;
  }
};

/**
 * @description Récupérer un email par son ID
 */
export const getEmailById = async (emailId) => {
  try {
    const response = await api.get(`/emails/${emailId}`);
    const email = response.data?.data || response.data;
    return email;
  } catch (error) {
    console.error(`❌ [emailService] Erreur lors du chargement de l'email ${emailId}:`, error);
    throw error;
  }
};

/**
 * @description Créer un nouvel email professionnel
 */
export const createEmail = async (emailData) => {
  try {
    const response = await api.post('/emails', emailData);
    const email = response.data?.data || response.data;
    return email;
  } catch (error) {
    console.error("❌ [emailService] Erreur lors de la création:", error);
    throw error;
  }
};

/**
 * @description Mettre à jour un email
 */
export const updateEmail = async (emailId, emailData) => {
  try {
    const response = await api.put(`/emails/${emailId}`, emailData);
    const email = response.data?.data || response.data;
    return email;
  } catch (error) {
    console.error(`❌ [emailService] Erreur lors de la mise à jour de l'email ${emailId}:`, error);
    throw error;
  }
};

/**
 * @description Supprimer un email
 */
export const deleteEmail = async (emailId) => {
  try {
    await api.delete(`/emails/${emailId}`);
  } catch (error) {
    console.error(`❌ [emailService] Erreur lors de la suppression de l'email ${emailId}:`, error);
    throw error;
  }
};

/**
 * @description Activer/Désactiver un email
 */
export const toggleEmailStatus = async (emailId) => {
  try {
    const response = await api.patch(`/emails/${emailId}/toggle`);
    const email = response.data?.data || response.data;
    return email;
  } catch (error) {
    console.error(`❌ [emailService] Erreur lors du changement de statut:`, error);
    throw error;
  }
};

/**
 * @description Mettre à jour les notifications d'un email
 */
export const updateNotifications = async (emailId, notifications) => {
  try {
    const response = await api.patch(`/emails/${emailId}/notifications`, { notifications });
    const email = response.data?.data || response.data;
    return email;
  } catch (error) {
    console.error(`❌ [emailService] Erreur lors de la mise à jour des notifications:`, error);
    throw error;
  }
};

/**
 * @description Récupérer les statistiques globales
 */
export const getGlobalStats = async () => {
  try {
    const response = await api.get('/emails/stats/global');
    const stats = response.data?.data || response.data;
    return stats;
  } catch (error) {
    console.error("❌ [emailService] Erreur lors du chargement des statistiques:", error);
    throw error;
  }
};

/**
 * @description Récupérer les emails recevant les notifications de devis
 */
export const getQuoteNotificationEmails = async () => {
  try {
    const response = await api.get('/emails/notifications/quotes');
    return response.data?.data || response.data || [];
  } catch (error) {
    console.error("❌ [emailService] Erreur:", error);
    throw error;
  }
};

/**
 * @description Récupérer les emails recevant les notifications de contact
 */
export const getContactNotificationEmails = async () => {
  try {
    const response = await api.get('/emails/notifications/contact');
    return response.data?.data || response.data || [];
  } catch (error) {
    console.error("❌ [emailService] Erreur:", error);
    throw error;
  }
};

/**
 * @description Récupérer les emails d'un collaborateur
 */
export const getEmailsByUser = async (userId) => {
  try {
    const response = await api.get(`/emails/user/${userId}`);
    return response.data?.data || response.data || [];
  } catch (error) {
    console.error("❌ [emailService] Erreur:", error);
    throw error;
  }
};

/**
 * @description Envoyer un email via Zoho Mail
 */
export const sendEmailViaZoho = async (fromEmail, toEmail, subject, content) => {
  try {
    const response = await api.post('/emails/send', { fromEmail, toEmail, subject, content });
    return response.data?.data || response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur lors de l'envoi de l'email:", error);
    throw new Error(error.response?.data?.message || "Erreur lors de l'envoi de l'email");
  }
};

/**
 * @description Synchroniser les emails avec Zoho Mail
 */
export const syncWithZoho = async () => {
  try {
    const response = await api.post('/emails/sync-zoho');
    return response.data?.data || response.data;
  } catch (error) {
    console.error("❌ [emailService] Erreur lors de la synchronisation:", error);
    throw new Error(error.response?.data?.message || 'Erreur lors de la synchronisation');
  }
};