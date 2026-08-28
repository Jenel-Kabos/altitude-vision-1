// src/services/messageService.js
import api from './api';

// ==========================================================
// --- 📧 GESTION DES EMAILS INTERNES (InternalMail) ---
// ==========================================================

export const sendInternalMail = async (emailData) => {
    try {
        const response = await api.post('/internal-mails', emailData);
        return response.data.data.message;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de l'envoi de l'email:", error);
        throw error;
    }
};

export const saveDraft = async (draftData) => {
    try {
        const response = await api.post('/internal-mails/drafts', draftData);
        return response.data.data.message;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la sauvegarde du brouillon:", error);
        throw error;
    }
};

export const updateDraft = async (draftId, draftData) => {
    try {
        const response = await api.put(`/internal-mails/drafts/${draftId}`, draftData);
        return response.data.data.message;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la mise à jour du brouillon:", error);
        throw error;
    }
};

export const deleteDraft = async (draftId) => {
    try {
        await api.delete(`/internal-mails/drafts/${draftId}`);
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la suppression du brouillon:", error);
        throw error;
    }
};

export const getReceivedMessages = async () => {
    try {
        const response = await api.get('/internal-mails/received');
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des emails reçus:", error);
        throw error;
    }
};

export const getSentMessages = async () => {
    try {
        const response = await api.get('/internal-mails/sent');
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des emails envoyés:", error);
        throw error;
    }
};

export const getUnreadMessages = async () => {
    try {
        const response = await api.get('/internal-mails/unread');
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des emails non lus:", error);
        throw error;
    }
};

export const getStarredMessages = async () => {
    try {
        const response = await api.get('/internal-mails/starred');
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des favoris:", error);
        throw error;
    }
};

export const getDraftMessages = async () => {
    try {
        const response = await api.get('/internal-mails/drafts');
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des brouillons:", error);
        throw error;
    }
};

export const getTrashedMessages = async () => {
    try {
        const response = await api.get('/internal-mails/trash');
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

export const previewInternalMailAttachment = async (endpoint) => {
    const response = await api.get(endpoint, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// HOTFIX-INBOX-SECURITY-2 — réservé aux pièces jointes classées "actives"
// (HTML/SVG, voir client/lib/utils/attachmentSecurity.js). Récupère le
// contenu texte pour sanitization (DOMPurify) puis rendu dans une iframe
// sandboxée — jamais un window.open sur le Blob brut pour ces types.
export const fetchInternalMailAttachmentContent = async (endpoint) => {
    const response = await api.get(endpoint, { responseType: 'blob' });
    return response.data.text();
};

// HOTFIX-INBOX-SECURITY-2 — réservé aux pièces jointes classées "actives".
// `window.open` sur un Blob HTML/SVG le rend/l'exécute au lieu de le
// sauvegarder (le Content-Disposition du serveur n'a plus d'effet une fois
// le Blob reconstruit côté client) — un lien `<a download>` force une
// sauvegarde réelle sans jamais exécuter le contenu, quel que soit le type.
export const downloadInternalMailAttachment = async (endpoint, filename) => {
    const response = await api.get(endpoint, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'attachment';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export const markAsRead = async (mailId) => {
    try {
        const response = await api.patch(`/internal-mails/${mailId}/read`);
        return response.data.data.message;
    } catch (error) {
        console.error('❌ [messageService] Erreur mark as read:', error);
        throw error;
    }
};

export const markAsUnread = async (mailId) => {
    try {
        const response = await api.patch(`/internal-mails/${mailId}/unread`);
        return response.data.data.message;
    } catch (error) {
        console.error(`❌ [messageService] Erreur lors du marquage comme non lu:`, error);
        throw error;
    }
};

export const addStar = async (mailId) => {
    try {
        const response = await api.patch(`/internal-mails/${mailId}/star`);
        return response.data.data.message;
    } catch (error) {
        console.error(`❌ [messageService] Erreur lors de l'ajout aux favoris:`, error);
        throw error;
    }
};

export const removeStar = async (mailId) => {
    try {
        const response = await api.patch(`/internal-mails/${mailId}/unstar`);
        return response.data.data.message;
    } catch (error) {
        console.error(`❌ [messageService] Erreur lors du retrait des favoris:`, error);
        throw error;
    }
};

export const moveToTrash = async (mailId) => {
    try {
        const response = await api.patch(`/internal-mails/${mailId}/trash`);
        return response.data.data.message;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du déplacement vers la corbeille:", error);
        throw error;
    }
};

export const restoreFromTrash = async (mailId) => {
    try {
        const response = await api.patch(`/internal-mails/${mailId}/restore`);
        return response.data.data.message;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la restauration:", error);
        throw error;
    }
};

export const permanentlyDelete = async (mailId) => {
    try {
        await api.delete(`/internal-mails/${mailId}/permanent`);
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la suppression définitive:", error);
        throw error;
    }
};

export const emptyTrash = async () => {
    try {
        await api.delete('/internal-mails/trash/empty');
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
        await api.delete(`/messages/${messageId}`);
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
        return response.data.data.conversations;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors du chargement des conversations récentes:", error);
        throw error;
    }
};

export const searchMessages = async (query) => {
    try {
        const response = await api.get(`/messages/search?query=${encodeURIComponent(query)}`);
        return response.data.data.messages;
    } catch (error) {
        console.error("❌ [messageService] Erreur lors de la recherche:", error);
        throw error;
    }
};
