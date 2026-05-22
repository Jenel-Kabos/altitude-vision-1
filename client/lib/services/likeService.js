// src/services/likeService.js
import api from './api';

/**
 * @description Liker/Unliker un élément
 * @param {String} targetType - 'Property' | 'Event' | 'Service'
 * @param {String} targetId - ID de l'élément
 */
export const toggleLike = async (targetType, targetId) => {
  try {
    
    const response = await api.post('/likes', { targetType, targetId });
    
    return response.data.data;
  } catch (error) {
    console.error('❌ [likeService] Erreur toggle like:', error);
    throw error;
  }
};

/**
 * @description Obtenir le statut de like
 * @param {String} targetType - 'Property' | 'Event' | 'Service'
 * @param {String} targetId - ID de l'élément
 */
export const getLikeStatus = async (targetType, targetId) => {
  try {
    const response = await api.get(`/likes/status/${targetType}/${targetId}`);
    return response.data.data;
  } catch (error) {
    console.error('❌ [likeService] Erreur get status:', error);
    return { likesCount: 0, liked: false };
  }
};

/**
 * @description Obtenir mes favoris
 * @param {String} type - Filtrer par type (optionnel)
 */
export const getMyFavorites = async (type = null) => {
  try {
    
    const url = type ? `/likes/my-favorites?type=${type}` : '/likes/my-favorites';
    const response = await api.get(url);
    
    return response.data.data.favorites;
  } catch (error) {
    console.error('❌ [likeService] Erreur get favorites:', error);
    throw error;
  }
};