// src/services/messageService.js
import api from './api';

// ==========================================================
// --- 📧 GESTION DES EMAILS INTERNES (InternalMail) ---
// ==========================================================

/**
 * @description Envoyer un email interne
 * @param {FormData} emailData - Données de l'email (avec pièces jointes)
 * @returns {Promise<Object>} - Email créé
 */
export const sendInternalMail = async (emailData) => {
    try {
        console.log("📤 [messageService] Envoi d'un email interne");
        const response = await api.post('/internal-mails', emailData);
        console.log("✅ [messageService] Email envoyé avec succès");
        return response.data.data.message;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de l'envoi de l'email:", error);
        throw error;
    }
};

/**
 * @description Sauvegarder un brouillon
 * @param {FormData} draftData - Données du brouillon
 * @returns {Promise<Object>} - Brouillon sauvegardé
 */
export const saveDraft = async (draftData) => {
    try {
        console.log("💾 [messageService] Sauvegarde d'un brouillon");
        const response = await api.post('/internal-mails/drafts', draftData);
        console.log("✅ [messageService] Brouillon sauvegardé avec succès");
        return response.data.data.message;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la sauvegarde du brouillon:", error);
        throw error;
    }
};

/**
 * @description Mettre à jour un brouillon existant
 * @param {string} draftId - ID du brouillon
 * @param {FormData} draftData - Nouvelles données du brouillon
 * @returns {Promise<Object>} - Brouillon mis à jour
 */
export const updateDraft = async (draftId, draftData) => {
    try {
        console.log(`💾 [messageService] Mise à jour du brouillon ${draftId}`);
        const response = await api.put(`/internal-mails/drafts/${draftId}`, draftData);
        console.log("✅ [messageService] Brouillon mis à jour avec succès");
        return response.data.data.message;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la mise à jour du brouillon:", error);
        throw error;
    }
};

/**
 * @description Supprimer un brouillon
 * @param {string} draftId - ID du brouillon
 * @returns {Promise<void>}
 */
export const deleteDraft = async (draftId) => {
    try {
        console.log(`🗑️ [messageService] Suppression du brouillon ${draftId}`);
        await api.delete(`/internal-mails/drafts/${draftId}`);
        console.log("✅ [messageService] Brouillon supprimé avec succès");
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la suppression du brouillon:", error);
        throw error;
    }
};

/**
 * @description Récupérer les emails reçus (Boîte de réception)
 * @returns {Promise<Array>} - Liste des emails reçus
 */
export const getReceivedMessages = async () => {
    try {
        const response = await api.get('/internal-mails/received');
        console.log("✅ [messageService] Emails reçus chargés:", response.data.results);
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des emails reçus:", error);
        throw error;
    }
};

/**
 * @description Récupérer les emails envoyés
 * @returns {Promise<Array>} - Liste des emails envoyés
 */
export const getSentMessages = async () => {
    try {
        const response = await api.get('/internal-mails/sent');
        console.log("✅ [messageService] Emails envoyés chargés:", response.data.results);
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des emails envoyés:", error);
        throw error;
    }
};

/**
 * @description Récupérer les emails non lus
 * @returns {Promise<Array>} - Liste des emails non lus
 */
export const getUnreadMessages = async () => {
    try {
        const response = await api.get('/internal-mails/unread');
        console.log("✅ [messageService] Emails non lus chargés:", response.data.results);
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des emails non lus:", error);
        throw error;
    }
};

/**
 * @description Récupérer les emails favoris
 * @returns {Promise<Array>} - Liste des emails favoris
 */
export const getStarredMessages = async () => {
    try {
        const response = await api.get('/internal-mails/starred');
        console.log("✅ [messageService] Emails favoris chargés:", response.data.results);
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des favoris:", error);
        throw error;
    }
};

/**
 * @description Récupérer les brouillons
 * @returns {Promise<Array>} - Liste des brouillons
 */
export const getDraftMessages = async () => {
    try {
        const response = await api.get('/internal-mails/drafts');
        console.log("✅ [messageService] Brouillons chargés:", response.data.results);
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des brouillons:", error);
        throw error;
    }
};

/**
 * @description Récupérer les emails dans la corbeille
 * @returns {Promise<Array>} - Liste des emails dans la corbeille
 */
export const getTrashedMessages = async () => {
    try {
        const response = await api.get('/internal-mails/trash');
        console.log("✅ [messageService] Emails de la corbeille chargés:", response.data.results);
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement de la corbeille:", error);
        throw error;
    }
};

/**
 * @description Compter les emails non lus (InternalMail)
 * @returns {Promise<number>} - Nombre d'emails non lus
 */
export const countUnread = async () => {
    try {
        const response = await api.get('/internal-mails/count/unread');
        return response.data.data.unreadCount;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du comptage des non lus:", error);
        // Retourner 0 au lieu de throw pour éviter de bloquer l'interface
        return 0;
    }
};

/**
 * @description Marquer un email comme lu
 * @param {string} mailId - L'identifiant de l'email
 * @returns {Promise<Object>} - Email mis à jour
 */
export const markAsRead = async (mailId) => {
    try {
        const response = await api.patch(`/internal-mails/${mailId}/read`);
        console.log(`✅ [messageService] Email ${mailId} marqué comme lu`);
        return response.data.data.message;
    } catch (error) {
        console.error('❌ [messageService] Erreur mark as read:', error);
        throw error;
    }
};

/**
 * @description Marquer un email comme non lu
 * @param {string} mailId - L'identifiant de l'email
 * @returns {Promise<Object>} - Email mis à jour
 */
export const markAsUnread = async (mailId) => {
    try {
        const response = await api.patch(`/internal-mails/${mailId}/unread`);
        console.log(`✅ [messageService] Email ${mailId} marqué comme non lu`);
        return response.data.data.message;
    } catch (error) {
        console.error(`❌ [messageService] Erreur lors du marquage comme non lu:`, error);
        throw error;
    }
};

/**
 * @description Ajouter un email aux favoris
 * @param {string} mailId - L'identifiant de l'email
 * @returns {Promise<Object>} - Email mis à jour
 */
export const addStar = async (mailId) => {
    try {
        const response = await api.patch(`/internal-mails/${mailId}/star`);
        console.log(`✅ [messageService] Email ${mailId} ajouté aux favoris`);
        return response.data.data.message;
    } catch (error) {
        console.error(`❌ [messageService] Erreur lors de l'ajout aux favoris:`, error);
        throw error;
    }
};

/**
 * @description Retirer un email des favoris
 * @param {string} mailId - L'identifiant de l'email
 * @returns {Promise<Object>} - Email mis à jour
 */
export const removeStar = async (mailId) => {
    try {
        const response = await api.patch(`/internal-mails/${mailId}/unstar`);
        console.log(`✅ [messageService] Email ${mailId} retiré des favoris`);
        return response.data.data.message;
    } catch (error) {
        console.error(`❌ [messageService] Erreur lors du retrait des favoris:`, error);
        throw error;
    }
};

/**
 * @description Déplacer un email vers la corbeille
 * @param {string} mailId - L'identifiant de l'email
 * @returns {Promise<Object>} - Email mis à jour
 */
export const moveToTrash = async (mailId) => {
    try {
        console.log(`🗑️ [messageService] Déplacement de l'email ${mailId} vers la corbeille`);
        const response = await api.patch(`/internal-mails/${mailId}/trash`);
        console.log("✅ [messageService] Email déplacé vers la corbeille");
        return response.data.data.message;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du déplacement vers la corbeille:", error);
        throw error;
    }
};

/**
 * @description Restaurer un email de la corbeille
 * @param {string} mailId - L'identifiant de l'email
 * @returns {Promise<Object>} - Email restauré
 */
export const restoreFromTrash = async (mailId) => {
    try {
        console.log(`♻️ [messageService] Restauration de l'email ${mailId}`);
        const response = await api.patch(`/internal-mails/${mailId}/restore`);
        console.log("✅ [messageService] Email restauré avec succès");
        return response.data.data.message;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la restauration:", error);
        throw error;
    }
};

/**
 * @description Supprimer définitivement un email
 * @param {string} mailId - L'identifiant de l'email
 * @returns {Promise<void>}
 */
export const permanentlyDelete = async (mailId) => {
    try {
        console.log(`💥 [messageService] Suppression définitive de l'email ${mailId}`);
        await api.delete(`/internal-mails/${mailId}/permanent`);
        console.log("✅ [messageService] Email supprimé définitivement");
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la suppression définitive:", error);
        throw error;
    }
};

/**
 * @description Vider la corbeille
 * @returns {Promise<void>}
 */
export const emptyTrash = async () => {
    try {
        console.log("🗑️ [messageService] Vidage de la corbeille");
        await api.delete('/internal-mails/trash/empty');
        console.log("✅ [messageService] Corbeille vidée avec succès");
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du vidage de la corbeille:", error);
        throw error;
    }
};

/**
 * @description Supprimer un email (alias pour moveToTrash)
 * @param {string} mailId - L'identifiant de l'email
 * @returns {Promise<void>}
 */
export const deleteMessage = async (mailId) => {
    return moveToTrash(mailId);
};

// ==========================================================
// --- 💬 GESTION DES CONVERSATIONS (Message) ---
// ==========================================================

/**
 * @description Envoyer un message dans une conversation
 * @param {Object|string} dataOrConversationId - Les données complètes ou l'ID de conversation
 * @param {string} [content] - Contenu du message
 * @param {Array} [attachments] - Pièces jointes
 * @returns {Promise<Object>} - Message créé
 */
export const sendMessage = async (dataOrConversationId, content, attachments = []) => {
    try {
        let messageData;
        
        // Format 1 : sendMessage({ conversationId: 'xxx', content: 'yyy' })
        if (typeof dataOrConversationId === 'object' && dataOrConversationId !== null) {
            messageData = dataOrConversationId;
        }
        // Format 2 : sendMessage('conversationId', 'content')
        else if (typeof dataOrConversationId === 'string' && content !== undefined) {
            messageData = {
                conversationId: dataOrConversationId,
                content,
                attachments
            };
        } else {
            throw new Error('Format de données invalide pour sendMessage');
        }

        const response = await api.post('/messages', messageData);
        return response.data.data.message; 
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de l'envoi du message de conversation:", error);
        throw error;
    }
};

/**
 * @description Obtenir les messages d'une conversation spécifique
 * @param {String} conversationId - ID de la conversation
 * @param {Number} page - Numéro de page
 * @param {Number} limit - Nombre de messages par page
 * @returns {Promise<{messages: Array, totalMessages: Number}>}
 */
export const getMessagesByConversation = async (conversationId, page = 1, limit = 50) => {
    try {
        const response = await api.get(`/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
        
        return {
            messages: response.data.data.messages,
            totalMessages: response.data.totalMessages || response.data.results || 0
        };
    } catch (error) {
        console.error('❌ [messageService] Erreur get messages conversation:', error);
        throw error;
    }
};

/**
 * @description Alias pour getMessagesByConversation
 */
export const getMessages = getMessagesByConversation;

/**
 * @description Récupérer la liste des conversations
 * @param {number} limit - Nombre de conversations à récupérer
 * @returns {Promise<Array>} - Liste des conversations
 */
export const getRecentConversations = async (limit = 10) => {
    try {
        const response = await api.get(`/messages/conversations/recent?limit=${limit}`);
        console.log("✅ [messageService] Conversations récentes chargées");
        return response.data.data.conversations;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des conversations récentes:", error);
        throw error;
    }
};

/**
 * @description Rechercher des messages
 * @param {string} query - Requête de recherche
 * @returns {Promise<Array>} - Messages correspondants
 */
export const searchMessages = async (query) => {
    try {
        const response = await api.get(`/messages/search?query=${encodeURIComponent(query)}`);
        console.log("✅ [messageService] Recherche effectuée:", response.data.results, "résultats");
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la recherche:", error);
        throw error;
    }
};