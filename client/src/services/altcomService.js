import axios from 'axios';

// URL de base de l'API (à adapter selon ton environnement)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Créer un nouveau projet Altcom
 * @param {Object} projectData - Données du projet
 * @returns {Promise} - Réponse de l'API
 */
export const createAltcomProject = async (projectData) => {
  try {
    console.log('🚀 [altcomService] Envoi du projet au backend:', projectData);
    
    const response = await axios.post(`${API_URL}/altcom/projects`, projectData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('✅ [altcomService] Réponse du serveur:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ [altcomService] Erreur lors de la création du projet:', error);
    
    // Gestion des erreurs
    if (error.response) {
      // Le serveur a répondu avec un code d'erreur
      console.error('Erreur serveur:', error.response.data);
      throw error.response.data;
    } else if (error.request) {
      // La requête a été envoyée mais pas de réponse
      console.error('Pas de réponse du serveur');
      throw { message: 'Impossible de contacter le serveur. Vérifiez votre connexion.' };
    } else {
      // Erreur lors de la configuration de la requête
      console.error('Erreur configuration:', error.message);
      throw { message: error.message || 'Erreur réseau' };
    }
  }
};

/**
 * Créer une demande de devis Altcom
 * @param {Object} quoteData - Données du devis
 * @returns {Promise} - Réponse de l'API
 */
export const createAltcomQuote = async (quoteData) => {
  try {
    console.log('🚀 [altcomService] Envoi du devis au backend:', quoteData);
    
    const response = await axios.post(`${API_URL}/altcom/quotes`, quoteData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('✅ [altcomService] Réponse du serveur:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ [altcomService] Erreur lors de la création du devis:', error);
    
    if (error.response) {
      throw error.response.data;
    } else if (error.request) {
      throw { message: 'Impossible de contacter le serveur. Vérifiez votre connexion.' };
    } else {
      throw { message: error.message || 'Erreur réseau' };
    }
  }
};

/**
 * Récupérer tous les projets Altcom (Admin)
 * @param {string} token - Token d'authentification
 * @param {string} status - Filtrer par statut (optionnel)
 * @returns {Promise} - Liste des projets
 */
export const getAllAltcomProjects = async (token, status = null) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    
    const url = status 
      ? `${API_URL}/altcom/projects?status=${status}` 
      : `${API_URL}/altcom/projects`;
    
    const response = await axios.get(url, config);
    return response.data;
    
  } catch (error) {
    console.error('❌ [altcomService] Erreur lors de la récupération des projets:', error);
    throw error.response?.data || { message: 'Erreur réseau' };
  }
};

/**
 * Récupérer un projet par ID (Admin)
 * @param {string} projectId - ID du projet
 * @param {string} token - Token d'authentification
 * @returns {Promise} - Détails du projet
 */
export const getAltcomProjectById = async (projectId, token) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    
    const response = await axios.get(`${API_URL}/altcom/projects/${projectId}`, config);
    return response.data;
    
  } catch (error) {
    console.error('❌ [altcomService] Erreur lors de la récupération du projet:', error);
    throw error.response?.data || { message: 'Erreur réseau' };
  }
};

/**
 * Mettre à jour le statut d'un projet (Admin)
 * @param {string} projectId - ID du projet
 * @param {string} status - Nouveau statut
 * @param {string} token - Token d'authentification
 * @returns {Promise} - Projet mis à jour
 */
export const updateAltcomProjectStatus = async (projectId, status, token) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    
    const response = await axios.patch(
      `${API_URL}/altcom/projects/${projectId}/status`,
      { status },
      config
    );
    
    return response.data;
    
  } catch (error) {
    console.error('❌ [altcomService] Erreur lors de la mise à jour du statut:', error);
    throw error.response?.data || { message: 'Erreur réseau' };
  }
};

/**
 * Supprimer un projet (Admin)
 * @param {string} projectId - ID du projet
 * @param {string} token - Token d'authentification
 * @returns {Promise} - Confirmation de suppression
 */
export const deleteAltcomProject = async (projectId, token) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    
    const response = await axios.delete(`${API_URL}/altcom/projects/${projectId}`, config);
    return response.data;
    
  } catch (error) {
    console.error('❌ [altcomService] Erreur lors de la suppression du projet:', error);
    throw error.response?.data || { message: 'Erreur réseau' };
  }
};
