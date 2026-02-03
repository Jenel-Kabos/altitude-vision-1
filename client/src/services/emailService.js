// src/services/emailService.js
import api from './api';

/**
 * @description Récupérer tous les emails professionnels
 * @returns {Promise<Array>} - Liste de tous les emails
 */
export const getAllEmails = async () => {
  try {
    console.log("📤 [emailService] Chargement des emails...");
    const response = await api.get('/company-emails');
    console.log("✅ [emailService] Emails chargés:", response.data.data.emails.length);
    return response.data.data.emails;
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
    const response = await api.get('/company-emails/active');
    console.log("✅ [emailService] Emails actifs chargés:", response.data.data.emails.length);
    return response.data.data.emails;
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
    const response = await api.get(`/company-emails/${emailId}`);
    console.log(`✅ [emailService] Email ${emailId} chargé`);
    return response.data.data.email;
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
    const response = await api.post('/company-emails', emailData);
    console.log("✅ [emailService] Email créé avec succès");
    return response.data.data.email;
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
    const response = await api.put(`/company-emails/${emailId}`, emailData);
    console.log("✅ [emailService] Email mis à jour avec succès");
    return response.data.data.email;
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
    await api.delete(`/company-emails/${emailId}`);
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
    const response = await api.patch(`/company-emails/${emailId}/toggle-status`);
    console.log("✅ [emailService] Statut mis à jour");
    return response.data.data.email;
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
    const response = await api.patch(`/company-emails/${emailId}/notifications`, { notifications });
    console.log("✅ [emailService] Notifications mises à jour");
    return response.data.data.email;
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
    const response = await api.get('/company-emails/stats');
    console.log("✅ [emailService] Statistiques chargées");
    return response.data.data;
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
    const response = await api.get('/company-emails/notifications/quotes');
    return response.data.data.emails;
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
    const response = await api.get('/company-emails/notifications/contact');
    return response.data.data.emails;
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
    const response = await api.get(`/company-emails/user/${userId}`);
    return response.data.data.emails;
  } catch (error) {
    console.error("❌ [emailService] Erreur:", error);
    throw error;
  }
};