// src/services/commentService.js
import api from './api';

/**
 * @description Créer un commentaire
 * @param {String} targetType - 'Property' | 'Event' | 'Service'
 * @param {String} targetId - ID de l'élément
 * @param {String} content - Contenu du commentaire
 */
export const createComment = async (targetType, targetId, content) => {
  try {
    console.log(`💬 [commentService] Create comment: ${targetType} ${targetId}`);
    
    const response = await api.post('/comments', { targetType, targetId, content });
    
    console.log(`✅ [commentService] Comment created:`, response.data.data.comment);
    return response.data.data.comment;
  } catch (error) {
    console.error('❌ [commentService] Erreur create comment:', error);
    throw error;
  }
};

/**
 * @description Obtenir les commentaires d'un élément
 * @param {String} targetType - 'Property' | 'Event' | 'Service'
 * @param {String} targetId - ID de l'élément
 * @param {Number} page - Numéro de page
 * @param {Number} limit - Nombre de commentaires par page
 */
export const getComments = async (targetType, targetId, page = 1, limit = 20) => {
  try {
    console.log(`📖 [commentService] Get comments: ${targetType} ${targetId}, page ${page}`);
    
    const response = await api.get(`/comments?targetType=${targetType}&targetId=${targetId}&page=${page}&limit=${limit}`);
    
    console.log(`✅ [commentService] ${response.data.results} commentaire(s) récupéré(s)`);
    return {
      comments: response.data.data.comments,
      totalComments: response.data.totalComments
    };
  } catch (error) {
    console.error('❌ [commentService] Erreur get comments:', error);
    return { comments: [], totalComments: 0 };
  }
};

/**
 * @description Modifier un commentaire
 * @param {String} commentId - ID du commentaire
 * @param {String} content - Nouveau contenu
 */
export const updateComment = async (commentId, content) => {
  try {
    console.log(`✏️ [commentService] Update comment: ${commentId}`);
    
    const response = await api.put(`/comments/${commentId}`, { content });
    
    console.log(`✅ [commentService] Comment updated`);
    return response.data.data.comment;
  } catch (error) {
    console.error('❌ [commentService] Erreur update comment:', error);
    throw error;
  }
};

/**
 * @description Supprimer un commentaire
 * @param {String} commentId - ID du commentaire
 */
export const deleteComment = async (commentId) => {
  try {
    console.log(`🗑️ [commentService] Delete comment: ${commentId}`);
    
    await api.delete(`/comments/${commentId}`);
    
    console.log(`✅ [commentService] Comment deleted`);
  } catch (error) {
    console.error('❌ [commentService] Erreur delete comment:', error);
    throw error;
  }
};

/**
 * @description Obtenir le nombre de commentaires
 * @param {String} targetType - 'Property' | 'Event' | 'Service'
 * @param {String} targetId - ID de l'élément
 */
export const getCommentsCount = async (targetType, targetId) => {
  try {
    const response = await api.get(`/comments/count/${targetType}/${targetId}`);
    return response.data.data.count;
  } catch (error) {
    console.error('❌ [commentService] Erreur get count:', error);
    return 0;
  }
};