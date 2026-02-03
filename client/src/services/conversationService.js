// src/services/conversationService.js
import api from './api';

/**
 * @description Créer ou récupérer une conversation
 * @param {String} recipientId - ID du destinataire
 * @param {String} initialMessage - Message initial (optionnel)
 * @param {String} relatedProperty - ID de la propriété liée (optionnel)
 * @param {String} relatedEvent - ID de l'événement lié (optionnel)
 */
export const createOrGetConversation = async (recipientId, initialMessage = '', relatedProperty = null, relatedEvent = null) => {
    try {
        const property = relatedProperty || undefined;
        const event = relatedEvent || undefined;

        const response = await api.post('/conversations', {
            recipientId,
            initialMessage,
            relatedProperty: property,
            relatedEvent: event
        });
        
        return response.data.data.conversation;
    } catch (error) {
        console.error('❌ [conversationService] Erreur create conversation:', error);
        throw error.response?.data?.message || error.message;
    }
};

/**
 * @description Obtenir toutes les conversations de l'utilisateur
 * @param {Number} page - Numéro de page
 * @param {Number} limit - Nombre de conversations par page
 * @param {String} status - Statut ('active' | 'archived')
 */
export const getUserConversations = async (page = 1, limit = 20, status = 'active') => {
    try {
        const response = await api.get(`/conversations?page=${page}&limit=${limit}&status=${status}`);
        
        return {
            conversations: response.data.data.conversations,
            totalConversations: response.data.totalConversations,
            totalUnread: response.data.totalUnread
        };
    } catch (error) {
        console.error('❌ [conversationService] Erreur get conversations:', error);
        return { conversations: [], totalConversations: 0, totalUnread: 0 };
    }
};

/**
 * @description Obtenir une conversation par ID
 * @param {String} conversationId - ID de la conversation
 */
export const getConversation = async (conversationId) => {
    try {
        const response = await api.get(`/conversations/${conversationId}`);
        return response.data.data.conversation;
    } catch (error) {
        console.error('❌ [conversationService] Erreur get conversation:', error);
        throw error.response?.data?.message || error.message;
    }
};

/**
 * @description Archiver une conversation
 * @param {String} conversationId - ID de la conversation
 */
export const archiveConversation = async (conversationId) => {
    try {
        await api.patch(`/conversations/${conversationId}/archive`);
    } catch (error) {
        console.error('❌ [conversationService] Erreur archive conversation:', error);
        throw error.response?.data?.message || error.message;
    }
};

/**
 * @description Marquer une conversation comme lue
 * @param {String} conversationId - ID de la conversation
 */
export const markConversationAsRead = async (conversationId) => {
    try {
        await api.patch(`/conversations/${conversationId}/mark-read`);
    } catch (error) {
        console.error('❌ [conversationService] Erreur mark as read:', error);
    }
};

/**
 * @description Obtenir le nombre de messages non lus
 */
export const getUnreadCount = async () => {
    try {
        const response = await api.get('/conversations/unread/count');
        return response.data.data.unreadCount;
    } catch (error) {
        console.error('❌ [conversationService] Erreur get unread count:', error);
        return 0;
    }
};