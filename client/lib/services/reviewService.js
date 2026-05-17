import api from './api';

/**
 * ============================================================
 * FONCTION UTILITAIRE - Extraction des avis depuis la réponse
 * ============================================================
 */
const extractReviewsFromResponse = (response, context = '') => {
  console.log(`📦 [reviewService] ${context} - Réponse brute:`, response.data);

  let reviews = [];

  // Format 1: response.data = [...]
  if (Array.isArray(response.data)) {
    console.log(`✅ [reviewService] ${context} - Format: Array direct`);
    reviews = response.data;
  }
  // Format 2: response.data.data = [...]
  else if (response.data.data && Array.isArray(response.data.data)) {
    console.log(`✅ [reviewService] ${context} - Format: response.data.data (Array)`);
    reviews = response.data.data;
  }
  // Format 3: response.data.data.reviews = [...]
  else if (response.data.data && response.data.data.reviews && Array.isArray(response.data.data.reviews)) {
    console.log(`✅ [reviewService] ${context} - Format: response.data.data.reviews`);
    reviews = response.data.data.reviews;
  }
  // Format 4: response.data.reviews = [...]
  else if (response.data.reviews && Array.isArray(response.data.reviews)) {
    console.log(`✅ [reviewService] ${context} - Format: response.data.reviews`);
    reviews = response.data.reviews;
  }
  // Format 5: Recherche intelligente
  else if (response.data && typeof response.data === 'object') {
    console.warn(`⚠️ [reviewService] ${context} - Format non standard, recherche automatique...`);
    const arrays = Object.entries(response.data).filter(([key, value]) => Array.isArray(value));
    console.log(`🔍 [reviewService] ${context} - Tableaux trouvés:`, arrays.map(([k, v]) => `${k} (${v.length})`));
    
    if (arrays.length > 0) {
      const [key, value] = arrays[0];
      console.log(`✅ [reviewService] ${context} - Utilisation du tableau: ${key}`);
      reviews = value;
    }
  }

  // Vérification finale
  if (!Array.isArray(reviews)) {
    console.error(`❌ [reviewService] ${context} - reviews n'est pas un tableau:`, reviews);
    return [];
  }

  console.log(`✅ [reviewService] ${context} - ${reviews.length} avis récupéré(s)`);
  return reviews;
};

/**
 * ============================================================
 * RÉCUPÉRATION DES AVIS
 * ============================================================
 */

/**
 * Récupérer toutes les reviews (avec filtres optionnels)
 * @param {Object} params - Paramètres de requête (pole, rating, page, limit, sort)
 * @returns {Promise<Array>} - Tableau d'avis
 */
export const getAllReviews = async (params = {}) => {
  try {
    console.log('🔍 [reviewService] getAllReviews appelé avec params:', params);
    
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/reviews?${queryString}`);
    
    return extractReviewsFromResponse(response, 'getAllReviews');
  } catch (error) {
    console.error('❌ [reviewService] Erreur getAllReviews:', error);
    console.error('❌ Détails:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return []; // ✅ Retourner tableau vide au lieu de throw
  }
};

/**
 * Récupérer les reviews d'un pôle spécifique
 * @param {String} pole - Nom du pôle (Altimmo, MilaEvents, Altcom)
 * @param {Number} limit - Nombre maximum d'avis à récupérer
 * @returns {Promise<Array>} - Tableau d'avis
 */
export const getReviewsByPole = async (pole, limit = 10) => {
  try {
    console.log(`🔍 [reviewService] getReviewsByPole appelé pour ${pole} avec limit:`, limit);
    
    const response = await api.get(`/reviews?pole=${pole}&limit=${limit}&sort=-createdAt`);
    
    return extractReviewsFromResponse(response, `getReviewsByPole(${pole})`);
  } catch (error) {
    console.error(`❌ [reviewService] Erreur getReviewsByPole(${pole}):`, error);
    console.error('❌ Détails:', error.response?.data);
    return []; // ✅ Retourner tableau vide au lieu de throw
  }
};

/**
 * Récupérer les reviews Altimmo
 * @param {Number} limit - Nombre maximum d'avis
 * @returns {Promise<Array>} - Tableau d'avis Altimmo
 */
export const getAltimmoReviews = async (limit = 6) => {
  console.log('🔍 [reviewService] getAltimmoReviews appelé');
  return getReviewsByPole('Altimmo', limit);
};

/**
 * Récupérer les reviews Mila Events
 * @param {Number} limit - Nombre maximum d'avis
 * @returns {Promise<Array>} - Tableau d'avis MilaEvents
 */
export const getMilaEventsReviews = async (limit = 6) => {
  console.log('🔍 [reviewService] getMilaEventsReviews appelé');
  return getReviewsByPole('MilaEvents', limit);
};

/**
 * Récupérer les reviews Altcom
 * @param {Number} limit - Nombre maximum d'avis
 * @returns {Promise<Array>} - Tableau d'avis Altcom
 */
export const getAltcomReviews = async (limit = 6) => {
  console.log('🔍 [reviewService] getAltcomReviews appelé');
  return getReviewsByPole('Altcom', limit);
};

/**
 * Récupérer tous les témoignages (pour HomePage - tous pôles mélangés)
 * @param {Number} limit - Nombre maximum d'avis
 * @returns {Promise<Array>} - Tableau d'avis
 */
export const getAllTestimonials = async (limit = 10) => {
  try {
    console.log('🔍 [reviewService] getAllTestimonials appelé avec limit:', limit);
    
    const response = await api.get(`/reviews?limit=${limit}&sort=-createdAt`);
    
    return extractReviewsFromResponse(response, 'getAllTestimonials');
  } catch (error) {
    console.error('❌ [reviewService] Erreur getAllTestimonials:', error);
    console.error('❌ Détails:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return []; // ✅ IMPORTANT: Retourner [] et non undefined
  }
};

/**
 * ============================================================
 * CRÉATION ET MODIFICATION D'AVIS
 * ============================================================
 */

/**
 * Créer une nouvelle review
 * @param {Object} reviewData - { rating, comment, pole }
 * @returns {Promise<Object>} - Avis créé
 */
export const createReview = async (reviewData) => {
  try {
    console.log('🔍 [reviewService] createReview appelé avec:', reviewData);
    
    const response = await api.post('/reviews', reviewData);
    
    console.log('✅ [reviewService] Avis créé avec succès:', response.data);
    
    // ✅ Extraction robuste
    if (response.data.data && response.data.data.review) {
      return response.data.data.review;
    } else if (response.data.review) {
      return response.data.review;
    } else if (response.data) {
      return response.data;
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ [reviewService] Erreur createReview:', error);
    console.error('❌ Détails:', error.response?.data);
    throw error; // ✅ Throw pour que le composant puisse gérer l'erreur
  }
};

/**
 * Mettre à jour une review
 * @param {String} reviewId - ID de la review
 * @param {Object} updateData - { rating, comment }
 * @returns {Promise<Object>} - Avis mis à jour
 */
export const updateReview = async (reviewId, updateData) => {
  try {
    console.log('🔍 [reviewService] updateReview appelé pour:', reviewId);
    
    const response = await api.patch(`/reviews/${reviewId}`, updateData);
    
    console.log('✅ [reviewService] Avis mis à jour:', response.data);
    
    // ✅ Extraction robuste
    if (response.data.data && response.data.data.review) {
      return response.data.data.review;
    } else if (response.data.review) {
      return response.data.review;
    } else if (response.data) {
      return response.data;
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ [reviewService] Erreur updateReview:', error);
    console.error('❌ Détails:', error.response?.data);
    throw error;
  }
};

/**
 * Supprimer une review (Admin uniquement)
 * @param {String} reviewId - ID de la review
 * @returns {Promise<void>}
 */
export const deleteReview = async (reviewId) => {
  try {
    console.log('🔍 [reviewService] deleteReview appelé pour:', reviewId);
    
    await api.delete(`/reviews/${reviewId}`);
    
    console.log('✅ [reviewService] Avis supprimé avec succès');
  } catch (error) {
    console.error('❌ [reviewService] Erreur deleteReview:', error);
    console.error('❌ Détails:', error.response?.data);
    throw error;
  }
};

/**
 * ============================================================
 * RÉPONSES ADMIN
 * ============================================================
 */

/**
 * Ajouter ou modifier la réponse admin à un avis (Admin uniquement)
 * @param {String} reviewId - ID de la review
 * @param {String} responseText - Texte de la réponse
 * @returns {Promise<Object>} - Avis mis à jour
 */
export const addAdminResponse = async (reviewId, responseText) => {
  try {
    console.log('🔍 [reviewService] addAdminResponse appelé pour:', reviewId);
    console.log('📝 Texte de la réponse:', responseText);
    
    const response = await api.patch(`/reviews/${reviewId}/admin-response`, {
      responseText,
    });
    
    console.log('✅ [reviewService] Réponse admin ajoutée:', response.data);
    
    // ✅ Extraction robuste
    if (response.data.data && response.data.data.review) {
      return response.data.data.review;
    } else if (response.data.review) {
      return response.data.review;
    } else if (response.data) {
      return response.data;
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ [reviewService] Erreur addAdminResponse:', error);
    console.error('❌ Détails:', error.response?.data);
    throw error;
  }
};

/**
 * Supprimer la réponse admin d'un avis (Admin uniquement)
 * @param {String} reviewId - ID de la review
 * @returns {Promise<Object>} - Avis mis à jour
 */
export const deleteAdminResponse = async (reviewId) => {
  try {
    console.log('🔍 [reviewService] deleteAdminResponse appelé pour:', reviewId);
    
    const response = await api.delete(`/reviews/${reviewId}/admin-response`);
    
    console.log('✅ [reviewService] Réponse admin supprimée:', response.data);
    
    // ✅ Extraction robuste
    if (response.data.data && response.data.data.review) {
      return response.data.data.review;
    } else if (response.data.review) {
      return response.data.review;
    } else if (response.data) {
      return response.data;
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ [reviewService] Erreur deleteAdminResponse:', error);
    console.error('❌ Détails:', error.response?.data);
    throw error;
  }
};

/**
 * ============================================================
 * EXPORT PAR DÉFAUT
 * ============================================================
 */
export default {
  getAllReviews,
  getReviewsByPole,
  getAltimmoReviews,
  getMilaEventsReviews,
  getAltcomReviews,
  getAllTestimonials,
  createReview,
  updateReview,
  deleteReview,
  addAdminResponse,
  deleteAdminResponse,
};