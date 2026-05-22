import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://altitude-vision.onrender.com/api';

/**
 * Envoyer un message de contact
 * @param {Object} messageData - Données du message
 * @returns {Promise} - Réponse de l'API
 */
export const sendContactMessage = async (messageData) => {
  try {
    
    const response = await axios.post(`${API_URL}/contact`, messageData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
    
  } catch (error) {
    console.error('❌ [contactService] Erreur lors de l\'envoi du message:', error);
    
    if (error.response) {
      console.error('Erreur serveur:', error.response.data);
      throw error.response.data;
    } else if (error.request) {
      console.error('Pas de réponse du serveur');
      throw { message: 'Impossible de contacter le serveur. Vérifiez votre connexion.' };
    } else {
      console.error('Erreur configuration:', error.message);
      throw { message: error.message || 'Erreur réseau' };
    }
  }
};

/**
 * Récupérer tous les messages de contact (Admin)
 * @param {string} token - Token d'authentification
 * @param {Object} params - Paramètres de filtrage (status, limit, page)
 * @returns {Promise} - Liste des messages
 */
export const getAllContactMessages = async (token, params = {}) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      params,
    };
    
    const response = await axios.get(`${API_URL}/contact`, config);
    return response.data;
    
  } catch (error) {
    console.error('❌ [contactService] Erreur lors de la récupération des messages:', error);
    throw error.response?.data || { message: 'Erreur réseau' };
  }
};

/**
 * Récupérer un message par ID (Admin)
 * @param {string} messageId - ID du message
 * @param {string} token - Token d'authentification
 * @returns {Promise} - Détails du message
 */
export const getContactMessageById = async (messageId, token) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    
    const response = await axios.get(`${API_URL}/contact/${messageId}`, config);
    return response.data;
    
  } catch (error) {
    console.error('❌ [contactService] Erreur lors de la récupération du message:', error);
    throw error.response?.data || { message: 'Erreur réseau' };
  }
};

/**
 * Mettre à jour le statut d'un message (Admin)
 * @param {string} messageId - ID du message
 * @param {string} status - Nouveau statut
 * @param {string} responseNote - Note de réponse (optionnel)
 * @param {string} token - Token d'authentification
 * @returns {Promise} - Message mis à jour
 */
export const updateMessageStatus = async (messageId, status, responseNote, token) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    
    const data = { status };
    if (responseNote) {
      data.responseNote = responseNote;
    }
    
    const response = await axios.patch(
      `${API_URL}/contact/${messageId}/status`,
      data,
      config
    );
    
    return response.data;
    
  } catch (error) {
    console.error('❌ [contactService] Erreur lors de la mise à jour du statut:', error);
    throw error.response?.data || { message: 'Erreur réseau' };
  }
};

/**
 * Supprimer un message (Admin)
 * @param {string} messageId - ID du message
 * @param {string} token - Token d'authentification
 * @returns {Promise} - Confirmation de suppression
 */
export const deleteContactMessage = async (messageId, token) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    
    const response = await axios.delete(`${API_URL}/contact/${messageId}`, config);
    return response.data;
    
  } catch (error) {
    console.error('❌ [contactService] Erreur lors de la suppression du message:', error);
    throw error.response?.data || { message: 'Erreur réseau' };
  }
};

/**
 * Récupérer les statistiques des messages (Admin)
 * @param {string} token - Token d'authentification
 * @returns {Promise} - Statistiques
 */
export const getContactStats = async (token) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    
    const response = await axios.get(`${API_URL}/contact/stats`, config);
    return response.data;
    
  } catch (error) {
    console.error('❌ [contactService] Erreur lors de la récupération des statistiques:', error);
    throw error.response?.data || { message: 'Erreur réseau' };
  }
};