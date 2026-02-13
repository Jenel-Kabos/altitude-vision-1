import api from './api';

/**
 * Récupérer toutes les reviews (avec filtres optionnels)
 * @param {Object} params - Paramètres de requête (pole, rating, page, limit, sort)
 */
export const getAllReviews = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/reviews?${queryString}`);
    return response.data.data.reviews;
  } catch (error) {
    console.error('Erreur lors de la récupération des reviews:', error);
    throw error;
  }
};

/**
 * Récupérer les reviews d'un pôle spécifique
 * @param {String} pole - Nom du pôle (Altimmo, MilaEvents, Altcom)
 * @param {Number} limit - Nombre maximum d'avis à récupérer
 */
export const getReviewsByPole = async (pole, limit = 10) => {
  try {
    const response = await api.get(`/reviews?pole=${pole}&limit=${limit}&sort=-createdAt`);
    return response.data.data.reviews;
  } catch (error) {
    console.error(`Erreur lors de la récupération des reviews ${pole}:`, error);
    throw error;
  }
};

/**
 * Récupérer les reviews Altimmo
 */
export const getAltimmoReviews = async (limit = 6) => {
  return getReviewsByPole('Altimmo', limit);
};

/**
 * Récupérer les reviews Mila Events
 */
export const getMilaEventsReviews = async (limit = 6) => {
  return getReviewsByPole('MilaEvents', limit);
};

/**
 * Récupérer les reviews Altcom
 */
export const getAltcomReviews = async (limit = 6) => {
  return getReviewsByPole('Altcom', limit);
};

/**
 * Récupérer tous les témoignages (pour HomePage - tous pôles mélangés)
 */
export const getAllTestimonials = async (limit = 10) => {
  try {
    const response = await api.get(`/reviews?limit=${limit}&sort=-createdAt`);
    return response.data.data.reviews;
  } catch (error) {
    console.error('Erreur lors de la récupération des témoignages:', error);
    throw error;
  }
};

/**
 * Créer une nouvelle review
 * @param {Object} reviewData - { rating, comment, pole }
 */
export const createReview = async (reviewData) => {
  try {
    const response = await api.post('/reviews', reviewData);
    return response.data.data.review;
  } catch (error) {
    console.error('Erreur lors de la création de la review:', error);
    throw error;
  }
};

/**
 * Mettre à jour une review
 * @param {String} reviewId - ID de la review
 * @param {Object} updateData - { rating, comment }
 */
export const updateReview = async (reviewId, updateData) => {
  try {
    const response = await api.patch(`/reviews/${reviewId}`, updateData);
    return response.data.data.review;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la review:', error);
    throw error;
  }
};

/**
 * Supprimer une review (Admin uniquement)
 * @param {String} reviewId - ID de la review
 */
export const deleteReview = async (reviewId) => {
  try {
    await api.delete(`/reviews/${reviewId}`);
  } catch (error) {
    console.error('Erreur lors de la suppression de la review:', error);
    throw error;
  }
};

/**
 * Ajouter ou modifier la réponse admin à un avis (Admin uniquement)
 * @param {String} reviewId - ID de la review
 * @param {String} responseText - Texte de la réponse
 */
export const addAdminResponse = async (reviewId, responseText) => {
  try {
    const response = await api.patch(`/reviews/${reviewId}/admin-response`, {
      responseText,
    });
    return response.data.data.review;
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la réponse admin:', error);
    throw error;
  }
};

/**
 * Supprimer la réponse admin d'un avis (Admin uniquement)
 * @param {String} reviewId - ID de la review
 */
export const deleteAdminResponse = async (reviewId) => {
  try {
    const response = await api.delete(`/reviews/${reviewId}/admin-response`);
    return response.data.data.review;
  } catch (error) {
    console.error('Erreur lors de la suppression de la réponse admin:', error);
    throw error;
  }
};