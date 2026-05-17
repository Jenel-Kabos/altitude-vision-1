import api from './api';

/**
 * Récupère tous les éléments du portfolio.
 * @param {string} pole - Filtrer par pôle (optionnel: 'Altcom', 'Altimmo', 'Mila Events')
 * @param {string} category - Filtrer par catégorie (optionnel)
 * @returns {Promise<Array>} - Promesse résolue avec le tableau des éléments.
 */
export const getAllPortfolioItems = async (pole = null, category = null) => {
  try {
    let url = '/portfolio';
    const params = [];
    
    if (pole) params.push(`pole=${pole}`);
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    
    const response = await api.get(url);
    return response.data.data.items;
  } catch (error) {
    console.error('❌ [portfolioService] Erreur lors de la récupération du portfolio:', error);
    throw error;
  }
};

/**
 * Récupère un élément du portfolio par son ID.
 * @param {string} id - ID de l'élément.
 * @returns {Promise<Object>} - Promesse résolue avec l'élément.
 */
export const getPortfolioItem = async (id) => {
  try {
    const response = await api.get(`/portfolio/${id}`);
    return response.data.data.item;
  } catch (error) {
    console.error(`❌ [portfolioService] Erreur lors de la récupération de l'élément ${id}:`, error);
    throw error;
  }
};

/**
 * Crée un nouvel élément de portfolio (Admin/Collaborateur).
 * @param {Object} itemData - Données de l'élément.
 * @returns {Promise<Object>} - Promesse résolue avec l'élément créé.
 */
export const createPortfolioItem = async (itemData) => {
  try {
    const response = await api.post('/portfolio', itemData);
    return response.data.data.item;
  } catch (error) {
    console.error('❌ [portfolioService] Erreur lors de la création de l\'élément:', error);
    throw error;
  }
};

/**
 * Met à jour un élément du portfolio (Admin/Collaborateur).
 * @param {string} id - ID de l'élément.
 * @param {Object} itemData - Données à mettre à jour.
 * @returns {Promise<Object>} - Promesse résolue avec l'élément mis à jour.
 */
export const updatePortfolioItem = async (id, itemData) => {
  try {
    const response = await api.patch(`/portfolio/${id}`, itemData);
    return response.data.data.item;
  } catch (error) {
    console.error(`❌ [portfolioService] Erreur lors de la mise à jour de l'élément ${id}:`, error);
    throw error;
  }
};

/**
 * Supprime un élément du portfolio (Admin uniquement).
 * @param {string} id - ID de l'élément.
 */
export const deletePortfolioItem = async (id) => {
  try {
    await api.delete(`/portfolio/${id}`);
  } catch (error) {
    console.error(`❌ [portfolioService] Erreur lors de la suppression de l'élément ${id}:`, error);
    throw error;
  }
};

/**
 * Récupère les reviews d'un élément du portfolio.
 * @param {string} portfolioItemId - ID de l'élément.
 * @returns {Promise<Array>} - Promesse résolue avec les reviews.
 */
export const getPortfolioReviews = async (portfolioItemId) => {
  try {
    const response = await api.get(`/portfolio/${portfolioItemId}/reviews`);
    return response.data.data.reviews;
  } catch (error) {
    console.error(`❌ [portfolioService] Erreur lors de la récupération des reviews:`, error);
    throw error;
  }
};

/**
 * Crée une review pour un élément du portfolio (utilisateur connecté).
 * @param {string} portfolioItemId - ID de l'élément.
 * @param {Object} reviewData - Données de la review (rating, comment).
 * @returns {Promise<Object>} - Promesse résolue avec la review créée.
 */
export const createPortfolioReview = async (portfolioItemId, reviewData) => {
  try {
    const response = await api.post(`/portfolio/${portfolioItemId}/reviews`, reviewData);
    return response.data.data.review;
  } catch (error) {
    console.error(`❌ [portfolioService] Erreur lors de la création de la review:`, error);
    throw error;
  }
};