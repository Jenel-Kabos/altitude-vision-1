import api from './api';

/**
 * Récupère tous les avis.
 * @param {Object} params - Paramètres de filtre et tri optionnels.
 * @returns {Promise<Array>} - Promesse résolue avec le tableau des reviews.
 */
export const getAllReviews = async (params = {}) => {
  try {
    const response = await api.get('/reviews', { params });
    return response.data.data.reviews;
  } catch (error) {
    console.error('Erreur lors de la récupération des avis :', error);
    throw error;
  }
};

/**
 * Crée un nouvel avis.
 * @param {Object} reviewData - Données de l'avis { rating, comment, portfolioItem }.
 * @returns {Promise<Object>} - Promesse résolue avec l'avis créé.
 */
export const createReview = async (reviewData) => {
  try {
    const response = await api.post('/reviews', reviewData);
    return response.data.data.review;
  } catch (error) {
    console.error('Erreur lors de la création de l’avis :', error);
    throw error;
  }
};

/**
 * Supprime un avis par son ID.
 * @param {string} id - ID de l’avis à supprimer.
 */
export const deleteReview = async (id) => {
  try {
    await api.delete(`/reviews/${id}`);
  } catch (error) {
    console.error('Erreur lors de la suppression de l’avis :', error);
    throw error;
  }
};
