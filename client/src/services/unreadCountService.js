// src/services/unreadCountService.js
import api from './api';

/**
 * @description Obtenir le nombre total de messages non lus
 * Combine les emails internes ET les messages de conversation
 * @returns {Promise<number>} - Nombre total de messages non lus
 */
export const getTotalUnreadCount = async () => {
    try {
        // Vérifier si l'utilisateur est connecté
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('⚠️ Aucun token disponible - utilisateur non connecté');
            return 0;
        }

        // 1. Compter les emails internes non lus
        let internalMailsUnread = 0;
        try {
            const internalResponse = await api.get('/internal-mails/count/unread');
            internalMailsUnread = internalResponse.data.data.unreadCount || 0;
            console.log('📧 Emails internes non lus:', internalMailsUnread);
        } catch (error) {
            // Ignorer les erreurs 401 (non authentifié) - normal si pas connecté
            if (error.response?.status !== 401) {
                console.error('❌ Erreur lors du comptage des emails internes:', error.message);
            }
        }

        // 2. Compter les messages de conversation non lus
        let conversationsUnread = 0;
        try {
            const conversationResponse = await api.get('/conversations/count/unread');
            conversationsUnread = conversationResponse.data.data.unreadCount || 0;
            console.log('💬 Conversations non lues:', conversationsUnread);
        } catch (error) {
            // Ignorer les erreurs 401 (non authentifié) - normal si pas connecté
            if (error.response?.status !== 401) {
                console.error('❌ Erreur lors du comptage des conversations:', error.message);
            }
        }

        const total = internalMailsUnread + conversationsUnread;
        console.log('📊 Total messages non lus:', total);
        
        return total;
    } catch (error) {
        console.error('❌ Erreur lors du comptage des messages non lus:', error);
        return 0;
    }
};

/**
 * @description Obtenir uniquement le nombre d'emails internes non lus
 * @returns {Promise<number>}
 */
export const getInternalMailsUnreadCount = async () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('⚠️ Aucun token disponible pour les emails internes');
            return 0;
        }

        const response = await api.get('/internal-mails/count/unread');
        const count = response.data.data.unreadCount || 0;
        console.log('📧 Emails internes non lus:', count);
        return count;
    } catch (error) {
        if (error.response?.status === 401) {
            console.warn('⚠️ Non authentifié - emails internes');
            return 0;
        }
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
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('⚠️ Aucun token disponible pour les conversations');
            return 0;
        }

        const response = await api.get('/conversations/count/unread');
        const count = response.data.data.unreadCount || 0;
        console.log('💬 Conversations non lues:', count);
        return count;
    } catch (error) {
        if (error.response?.status === 401) {
            console.warn('⚠️ Non authentifié - conversations');
            return 0;
        }
        console.error('❌ Erreur lors du comptage des conversations non lues:', error);
        return 0;
    }
};