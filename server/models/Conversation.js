// server/models/Conversation.js

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    lastMessage: {
        type: String,
        default: 'Nouvelle conversation',
    },
    // Map pour stocker le nombre de non lus par ID utilisateur
    unreadCount: {
        type: Map,
        of: Number, 
        default: new Map(),
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    relatedProperty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        default: null,
    },
    relatedEvent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        default: null,
    },
}, {
    timestamps: true 
});

// --- ⭐ Méthodes d'Instance (Instance Methods) ⭐ ---

conversationSchema.methods.updateLastMessage = function (content) {
    this.lastMessage = content;
    this.updatedAt = Date.now();
    return this.save();
};

conversationSchema.methods.incrementUnread = function (recipientId) {
    const recipientIdString = recipientId.toString();
    const currentCount = this.unreadCount.get(recipientIdString) || 0;
    this.unreadCount.set(recipientIdString, currentCount + 1);
    return this.save(); 
};

conversationSchema.methods.resetUnread = function (userId) {
    const userIdString = userId.toString();
    this.unreadCount.set(userIdString, 0);
    return this.save(); 
};


// --- ⭐ Méthodes Statiques (Classe Methods - Correction de la TypeError) ⭐ ---

/**
 * Récupère les conversations d'un utilisateur avec pagination et statut.
 */
conversationSchema.statics.getUserConversations = function (userId, page, limit, status) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {
        participants: userId,
    };

    if (status === 'archived') {
        query.isArchived = true;
    } else {
        query.isArchived = { $ne: true }; 
    }

    const conversationsQuery = this.find(query)
        .sort({ updatedAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        // Peupler les autres participants (tous sauf l'utilisateur actuel)
        .populate({
            path: 'participants',
            select: 'name avatar email',
            match: { _id: { $ne: userId } } // Exclure l'utilisateur lui-même
        });

    const totalCountQuery = this.countDocuments(query);

    return Promise.all([conversationsQuery, totalCountQuery]);
};

module.exports = mongoose.model('Conversation', conversationSchema);