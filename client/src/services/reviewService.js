import api from './api';

/**
 * Récupère tous les avis.
 * @param {Object} params - Paramètres de filtre et tri optionnels (ex: { limit: 5, sort: '-rating' }).
 * @returns {Promise<Array>} - Promesse résolue avec le tableau des reviews.
 */
export const getAllReviews = async (params = {}) => {
  try {
    const response = await api.get('/reviews', { params });

    // 🛡️ SÉCURITÉ : On vérifie la structure de la réponse pour trouver le tableau
    // Cela gère les cas { data: { reviews: [] } }, { data: [] } ou { reviews: [] }
    let reviews = [];

    if (response.data?.data?.reviews && Array.isArray(response.data.data.reviews)) {
      reviews = response.data.data.reviews;
    } else if (response.data?.reviews && Array.isArray(response.data.reviews)) {
      reviews = response.data.reviews;
    } else if (Array.isArray(response.data)) {
      reviews = response.data;
    } else if (Array.isArray(response.data?.data)) {
      reviews = response.data.data;
    }

    return reviews;

  } catch (error) {
    console.error('Erreur lors de la récupération des avis :', error);
    // En cas d'erreur, on renvoie un tableau vide pour ne pas faire planter l'interface
    return [];
  }
};

/**
 * Crée un nouvel avis.
 * @param {Object} reviewData - Données de l'avis { rating: Number, review: String, portfolioItem: ID (optionnel) }.
 * @returns {Promise<Object>} - Promesse résolue avec l'avis créé.
 */
export const createReview = async (reviewData) => {
  try {
    const response = await api.post('/reviews', reviewData);
    
    // On renvoie l'objet créé (avec gestion sécurisée de la structure)
    return response.data?.data?.review || response.data?.data || response.data;
  } catch (error) {
    console.error('Erreur lors de la création de l’avis :', error);
    // Ici on relance l'erreur pour pouvoir afficher le Toast.error dans le composant
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
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression de l’avis :', error);
    throw error;
  }
};