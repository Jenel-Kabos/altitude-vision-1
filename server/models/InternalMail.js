// server/models/InternalMail.js
const mongoose = require('mongoose');

const internalMailSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      // Le destinataire est requis seulement si ce n'est pas un brouillon
      return !this.isDraft;
    }
  },
  subject: {
    type: String,
    default: 'Sans objet',
    maxlength: 200,
  },
  content: {
    type: String,
    required: [true, 'Le contenu du message est requis'],
    maxlength: 10000,
  },
  priority: {
    type: String,
    enum: ['Basse', 'Normale', 'Haute', 'Urgente'],
    default: 'Normale',
  },
  
  // ========== STATUTS ==========
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  isStarred: {
    type: Boolean,
    default: false,
  },
  isDraft: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
  
  // ========== PIÈCES JOINTES ==========
  attachments: [
    {
      filename: { 
        type: String, 
        required: true 
      },
      filepath: { 
        type: String, 
        required: true 
      },
      mimetype: { 
        type: String 
      },
      size: { 
        type: Number 
      }
    }
  ],
  
  // ========== MÉTADONNÉES ==========
  messageType: {
    type: String,
    default: 'Email',
  },
  
}, {
  timestamps: true,
});

// ========== INDEX POUR PERFORMANCES ==========
internalMailSchema.index({ sender: 1, createdAt: -1 });
internalMailSchema.index({ receiver: 1, createdAt: -1 });
internalMailSchema.index({ receiver: 1, isRead: 1 });
internalMailSchema.index({ receiver: 1, isStarred: 1 });
internalMailSchema.index({ sender: 1, isDraft: 1 });
internalMailSchema.index({ receiver: 1, isDeleted: 1 });
internalMailSchema.index({ sender: 1, isDeleted: 1 });

// ========== MÉTHODES STATIQUES ==========

/**
 * Récupérer les emails reçus (non supprimés, non brouillons)
 */
internalMailSchema.statics.getInbox = function(userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    receiver: userId,
    isDraft: false,
    isDeleted: false,
  })
    .populate('sender', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);
};

/**
 * Récupérer les emails envoyés (non supprimés, non brouillons)
 */
internalMailSchema.statics.getSent = function(userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    sender: userId,
    isDraft: false,
    isDeleted: false,
  })
    .populate('receiver', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);
};

/**
 * Récupérer les emails non lus
 */
internalMailSchema.statics.getUnread = function(userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    receiver: userId,
    isRead: false,
    isDraft: false,
    isDeleted: false,
  })
    .populate('sender', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);
};

/**
 * Récupérer les emails favoris
 */
internalMailSchema.statics.getStarred = function(userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    $or: [
      { receiver: userId, isStarred: true },
      { sender: userId, isStarred: true }
    ],
    isDraft: false,
    isDeleted: false,
  })
    .populate('sender', 'name email avatar')
    .populate('receiver', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);
};

/**
 * Récupérer les brouillons
 */
internalMailSchema.statics.getDrafts = function(userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    sender: userId,
    isDraft: true,
    isDeleted: false,
  })
    .populate('receiver', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);
};

/**
 * Récupérer la corbeille
 */
internalMailSchema.statics.getTrash = function(userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    $or: [
      { receiver: userId, isDeleted: true },
      { sender: userId, isDeleted: true }
    ],
  })
    .populate('sender', 'name email avatar')
    .populate('receiver', 'name email avatar')
    .sort({ deletedAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);
};

/**
 * Compter les emails non lus
 */
internalMailSchema.statics.countUnread = function(userId) {
  return this.countDocuments({
    receiver: userId,
    isRead: false,
    isDraft: false,
    isDeleted: false,
  });
};

module.exports = mongoose.model('InternalMail', internalMailSchema);