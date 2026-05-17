// src/services/messageService.js
import api from './api';

// ==========================================================
// --- 📧 GESTION DES EMAILS INTERNES (InternalMail) ---
// ==========================================================

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

export const countUnread = async () => {
    try {
        const response = await api.get('/internal-mails/count/unread');
        return response.data.data.unreadCount;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du comptage des non lus:", error);
        return 0;
    }
};

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
 * @description Supprimer un email interne (alias pour moveToTrash)
 * ⚠️  NE PAS utiliser pour les messages de conversation — utiliser deleteConversationMessage
 */
export const deleteMessage = async (mailId) => {
    return moveToTrash(mailId);
};

// ==========================================================
// --- 💬 GESTION DES CONVERSATIONS (Message) ---
// ==========================================================

/**
 * @description Envoyer un message dans une conversation
 */
export const sendMessage = async (dataOrConversationId, content, attachments = []) => {
    try {
        let messageData;

        if (typeof dataOrConversationId === 'object' && dataOrConversationId !== null) {
            messageData = dataOrConversationId;
        } else if (typeof dataOrConversationId === 'string' && content !== undefined) {
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
 * @description Supprimer un message de conversation
 * ✅ Utilise DELETE /messages/:id (et non /internal-mails)
 */
export const deleteConversationMessage = async (messageId) => {
    try {
        console.log(`🗑️ [messageService] Suppression du message de conversation ${messageId}`);
        await api.delete(`/messages/${messageId}`);
        console.log("✅ [messageService] Message supprimé avec succès");
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la suppression du message:", error);
        throw error;
    }
};

/**
 * @description Obtenir les messages d'une conversation spécifique
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

/** @description Alias pour getMessagesByConversation */
export const getMessages = getMessagesByConversation;

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