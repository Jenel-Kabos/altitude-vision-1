// src/services/unreadCountService.js
import api from './api';

/**
 * @description Obtenir le nombre total de messages non lus
 * Combine les emails internes ET les messages de conversation
 * @returns {Promise<number>} - Nombre total de messages non lus
 */
export const getTotalUnreadCount = async () => {
    try {
        // 1. Compter les emails internes non lus
        let internalMailsUnread = 0;
        try {
            const internalResponse = await api.get('/internal-mails/count/unread');
            internalMailsUnread = internalResponse.data.data.unreadCount || 0;
        } catch (error) {
            console.warn('⚠️ Emails internes non disponibles:', error.message);
            // Continue même si cette route échoue
        }

        // 2. Compter les messages de conversation non lus
        let conversationsUnread = 0;
        try {
            const conversationResponse = await api.get('/conversations/count/unread');
            conversationsUnread = conversationResponse.data.data.unreadCount || 0;
        } catch (error) {
            console.warn('⚠️ Messages de conversation non disponibles:', error.message);
            // Continue même si cette route échoue
        }

        const total = internalMailsUnread + conversationsUnread;
        
        console.log(`📊 Messages non lus - Emails: ${internalMailsUnread}, Conversations: ${conversationsUnread}, Total: ${total}`);
        
        return total;
    } catch (error) {
        console.error('❌ Erreur lors du comptage des messages non lus:', error);
        return 0; // Retourner 0 au lieu de throw pour éviter de bloquer l'interface
    }
};

/**
 * @description Obtenir uniquement le nombre d'emails internes non lus
 * @returns {Promise<number>}
 */
export const getInternalMailsUnreadCount = async () => {
    try {
        const response = await api.get('/internal-mails/count/unread');
        return response.data.data.unreadCount || 0;
    } catch (error) {
        console.error('❌ Erreur lors du comptage des emails internes non lus:', error);
        return 0;
    }
};

/**
 * @description Obtenir uniquement le nombre de messages de conversation non lus
 * @returns {Promise<number>}
 */
export const getConversationsUnreadCount = async () => {
    try {
        const response = await api.get('/conversations/count/unread');
        return response.data.data.unreadCount || 0;
    } catch (error) {
        console.error('❌ Erreur lors du comptage des conversations non lues:', error);
        return 0;
    }
};