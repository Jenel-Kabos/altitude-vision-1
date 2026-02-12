import api from './api';

/**
 * Service pour gérer les avis clients (reviews)
 */

/**
 * Récupère tous les avis.
 * @param {Object} params - Paramètres de filtre et tri optionnels
 * @param {string} params.pole - Filtrer par pôle ('Altcom', 'Altvision', 'Altsky')
 * @param {boolean} params.isPublished - Filtrer par statut de publication
 * @param {number} params.minRating - Note minimale
 * @param {number} params.limit - Limite de résultats
 * @param {string} params.sort - Tri (ex: '-rating', 'createdAt')
 * @returns {Promise<Array>} - Promesse résolue avec le tableau des reviews
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
 * Récupérer un avis par son ID
 * @param {string} id - ID de l'avis
 * @returns {Promise<Object>} Avis trouvé
 */
export const getReviewById = async (id) => {
  try {
    const response = await api.get(`/reviews/${id}`);
    
    // Gestion sécurisée de la structure de réponse
    return response.data?.data?.review || response.data?.data || response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération de l'avis ${id}:`, error);
    throw new Error(error.response?.data?.message || 'Avis introuvable');
  }
};

/**
 * Récupérer les avis pour Altcom uniquement (publiés)
 * @param {Object} options - Options supplémentaires
 * @param {number} options.limit - Limite de résultats (optionnel)
 * @param {string} options.sort - Tri (optionnel, ex: '-createdAt', '-rating')
 * @returns {Promise<Array>} Liste des avis Altcom
 */
export const getAltcomReviews = async (options = {}) => {
  const params = { 
    pole: 'Altcom', 
    isPublished: true,
    ...options 
  };
  
  return getAllReviews(params);
};

/**
 * Récupérer les avis pour Altvision uniquement (publiés)
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<Array>} Liste des avis Altvision
 */
export const getAltvisionReviews = async (options = {}) => {
  const params = { 
    pole: 'Altvision', 
    isPublished: true,
    ...options 
  };
  
  return getAllReviews(params);
};

/**
 * Récupérer les avis pour Altsky uniquement (publiés)
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<Array>} Liste des avis Altsky
 */
export const getAltskyReviews = async (options = {}) => {
  const params = { 
    pole: 'Altsky', 
    isPublished: true,
    ...options 
  };
  
  return getAllReviews(params);
};

/**
 * Crée un nouvel avis.
 * @param {Object} reviewData - Données de l'avis
 * @param {string} reviewData.author - Nom de l'auteur
 * @param {string} reviewData.content - Contenu de l'avis (ou reviewData.review)
 * @param {number} reviewData.rating - Note (1-5)
 * @param {string} reviewData.company - Entreprise de l'auteur (optionnel)
 * @param {string} reviewData.pole - Pôle concerné ('Altcom', 'Altvision', 'Altsky') (optionnel)
 * @param {string} reviewData.position - Poste de l'auteur (optionnel)
 * @param {string} reviewData.projectType - Type de projet (optionnel)
 * @param {string} reviewData.portfolioItem - ID du projet portfolio lié (optionnel)
 * @returns {Promise<Object>} - Promesse résolue avec l'avis créé
 */
export const createReview = async (reviewData) => {
  try {
    const response = await api.post('/reviews', reviewData);
    
    // On renvoie l'objet créé (avec gestion sécurisée de la structure)
    return response.data?.data?.review || response.data?.data || response.data;
  } catch (error) {
    console.error('Erreur lors de la création de l\'avis :', error);
    // Ici on relance l'erreur pour pouvoir afficher le Toast.error dans le composant
    throw error;
  }
};

/**
 * Mettre à jour un avis existant
 * @param {string} id - ID de l'avis
 * @param {Object} updateData - Données à mettre à jour
 * @returns {Promise<Object>} Avis mis à jour
 */
export const updateReview = async (id, updateData) => {
  try {
    const response = await api.put(`/reviews/${id}`, updateData);
    
    // Gestion sécurisée de la structure de réponse
    return response.data?.data?.review || response.data?.data || response.data;
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de l'avis ${id}:`, error);
    throw new Error(error.response?.data?.message || 'Erreur lors de la mise à jour');
  }
};

/**
 * Supprime un avis par son ID.
 * @param {string} id - ID de l'avis à supprimer
 * @returns {Promise<boolean>} - true si suppression réussie
 */
export const deleteReview = async (id) => {
  try {
    await api.delete(`/reviews/${id}`);
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'avis :', error);
    throw error;
  }
};

/**
 * Récupérer les statistiques des avis
 * @param {string} pole - Pôle concerné (optionnel: 'Altcom', 'Altvision', 'Altsky')
 * @param {boolean} publishedOnly - Ne compter que les avis publiés (par défaut: true)
 * @returns {Promise<Object>} Statistiques (moyenne, total, répartition)
 */
export const getReviewStats = async (pole = null, publishedOnly = true) => {
  try {
    const params = {};
    if (pole) params.pole = pole;
    if (publishedOnly) params.isPublished = true;
    
    const reviews = await getAllReviews(params);
    
    if (reviews.length === 0) {
      return {
        total: 0,
        averageRating: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      };
    }
    
    const total = reviews.length;
    const sumRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    const averageRating = (sumRating / total).toFixed(1);
    
    const distribution = reviews.reduce((acc, review) => {
      const rating = review.rating || 0;
      if (rating >= 1 && rating <= 5) {
        acc[rating] = (acc[rating] || 0) + 1;
      }
      return acc;
    }, { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
    
    return { 
      total, 
      averageRating: parseFloat(averageRating), 
      distribution 
    };
  } catch (error) {
    console.error('Erreur lors du calcul des statistiques:', error);
    return {
      total: 0,
      averageRating: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };
  }
};

/**
 * Récupérer les avis les mieux notés
 * @param {Object} options - Options de filtrage
 * @param {string} options.pole - Pôle concerné (optionnel)
 * @param {number} options.minRating - Note minimale (par défaut: 4)
 * @param {number} options.limit - Nombre maximum d'avis (par défaut: 10)
 * @returns {Promise<Array>} Liste des avis les mieux notés
 */
export const getTopReviews = async (options = {}) => {
  const params = {
    isPublished: true,
    minRating: options.minRating || 4,
    sort: '-rating,-createdAt',
    limit: options.limit || 10,
    ...(options.pole && { pole: options.pole })
  };
  
  return getAllReviews(params);
};

/**
 * Récupérer les avis récents
 * @param {Object} options - Options de filtrage
 * @param {string} options.pole - Pôle concerné (optionnel)
 * @param {number} options.limit - Nombre maximum d'avis (par défaut: 5)
 * @returns {Promise<Array>} Liste des avis récents
 */
export const getRecentReviews = async (options = {}) => {
  const params = {
    isPublished: true,
    sort: '-createdAt',
    limit: options.limit || 5,
    ...(options.pole && { pole: options.pole })
  };
  
  return getAllReviews(params);
};

/**
 * Basculer le statut de publication d'un avis
 * @param {string} id - ID de l'avis
 * @param {boolean} isPublished - Nouveau statut de publication
 * @returns {Promise<Object>} Avis mis à jour
 */
export const toggleReviewPublication = async (id, isPublished) => {
  try {
    const response = await api.patch(`/reviews/${id}/publish`, { isPublished });
    
    return response.data?.data?.review || response.data?.data || response.data;
  } catch (error) {
    console.error(`Erreur lors du changement de statut de l'avis ${id}:`, error);
    throw new Error(error.response?.data?.message || 'Erreur lors du changement de statut');
  }
};

/**
 * Récupérer les avis associés à un projet portfolio spécifique
 * @param {string} portfolioItemId - ID du projet portfolio
 * @returns {Promise<Array>} Liste des avis du projet
 */
export const getReviewsByPortfolioItem = async (portfolioItemId) => {
  try {
    const params = { 
      portfolioItem: portfolioItemId,
      isPublished: true 
    };
    
    return getAllReviews(params);
  } catch (error) {
    console.error(`Erreur lors de la récupération des avis du projet ${portfolioItemId}:`, error);
    return [];
  }
};

/**
 * Rechercher des avis par mot-clé
 * @param {string} keyword - Mot-clé de recherche
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<Array>} Liste des avis correspondants
 */
export const searchReviews = async (keyword, options = {}) => {
  try {
    const params = {
      search: keyword,
      isPublished: true,
      ...options
    };
    
    return getAllReviews(params);
  } catch (error) {
    console.error('Erreur lors de la recherche d\'avis:', error);
    return [];
  }
};

// Export par défaut de toutes les fonctions
export default {
  getAllReviews,
  getReviewById,
  getAltcomReviews,
  getAltvisionReviews,
  getAltskyReviews,
  createReview,
  updateReview,
  deleteReview,
  getReviewStats,
  getTopReviews,
  getRecentReviews,
  toggleReviewPublication,
  getReviewsByPortfolioItem,
  searchReviews
};