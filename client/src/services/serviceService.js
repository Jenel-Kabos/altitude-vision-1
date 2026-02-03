import api from './api';

/**
 * Récupérer tous les services pour une division spécifique
 * @param {string} division - Nom de la division (ex: 'Altcom', 'Altimmo', 'MilaEvents')
 * @returns {Promise<Array>} Liste des services
 */
export const getAllServices = async (division = null) => {
  try {
    const url = division ? `/services?division=${division}` : '/services';
    const response = await api.get(url);
    
    return response.data?.data?.services || response.data?.services || [];
  } catch (error) {
    console.error('❌ [serviceService] Erreur getAllServices:', error);
    throw error;
  }
};

/**
 * Récupérer un service par son ID
 * @param {string} id - ID du service
 * @returns {Promise<Object>} Détails du service
 */
export const getServiceById = async (id) => {
  try {
    const response = await api.get(`/services/${id}`);
    return response.data?.data?.service || response.data?.service || null;
  } catch (error) {
    console.error('❌ [serviceService] Erreur getServiceById:', error);
    throw error;
  }
};

/**
 * Créer un nouveau service
 * @param {Object} serviceData - Données du service
 * @returns {Promise<Object>} Service créé
 */
export const createService = async (serviceData) => {
  try {
    const response = await api.post('/services', serviceData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.data?.data?.service || response.data?.service || null;
  } catch (error) {
    console.error('❌ [serviceService] Erreur createService:', error);
    throw error;
  }
};

/**
 * Mettre à jour un service existant
 * @param {string} id - ID du service
 * @param {Object} serviceData - Données mises à jour
 * @returns {Promise<Object>} Service mis à jour
 */
export const updateService = async (id, serviceData) => {
  try {
    const response = await api.put(`/services/${id}`, serviceData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.data?.data?.service || response.data?.service || null;
  } catch (error) {
    console.error('❌ [serviceService] Erreur updateService:', error);
    throw error;
  }
};

/**
 * Supprimer un service
 * @param {string} id - ID du service
 * @returns {Promise<Object>} Confirmation de suppression
 */
export const deleteService = async (id) => {
  try {
    const response = await api.delete(`/services/${id}`);
    return response.data;
  } catch (error) {
    console.error('❌ [serviceService] Erreur deleteService:', error);
    throw error;
  }
};