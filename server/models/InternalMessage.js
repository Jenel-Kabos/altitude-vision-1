// server/models/InternalMessage.js
const mongoose = require('mongoose');

// ======================================================
// 🧩 SCHEMA MESSAGE INTERNE (Chat Collaborateurs)
// ======================================================
const internalMessageSchema = new mongoose.Schema(
  {
    // 👤 Expéditeur (collaborateur)
    sender: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Un expéditeur est requis.'],
    },

    // 👥 Destinataire(s)
    recipients: {
      type: [mongoose.Schema.ObjectId],
      ref: 'User',
      required: [true, 'Au moins un destinataire est requis.'],
      validate: {
        validator: function(v) {
          return v && v.length > 0;
        },
        message: 'Au moins un destinataire est requis.',
      },
    },

    // 📝 Contenu du message
    content: {
      type: String,
      required: [true, 'Le contenu du message est requis.'],
      trim: true,
      maxlength: [5000, 'Le message ne doit pas dépasser 5000 caractères.'],
    },

    // 🏷️ Sujet/Titre (optionnel)
    subject: {
      type: String,
      trim: true,
      maxlength: [200, 'Le sujet ne doit pas dépasser 200 caractères.'],
    },

    // 📎 Pièces jointes (URLs)
    attachments: {
      type: [String],
      default: [],
      validate: {
        validator: function(v) {
          return v.length <= 5;
        },
        message: 'Maximum 5 pièces jointes autorisées',
      },
    },

    // 🔖 Type de message
    messageType: {
      type: String,
      enum: ['Message', 'Notification', 'Alerte', 'Rappel'],
      default: 'Message',
    },

    // 📊 Priorité
    priority: {
      type: String,
      enum: ['Basse', 'Normale', 'Haute', 'Urgente'],
      default: 'Normale',
    },

    // 👁️ Statut de lecture par destinataire
    readBy: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // 💬 Fil de conversation (ID du message parent si c'est une réponse)
    threadId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InternalMessage',
    },

    // 🔗 Référence externe (ex: ID d'un devis, propriété, événement)
    relatedTo: {
      model: {
        type: String,
        enum: ['Quote', 'Property', 'Event', 'User', null],
      },
      id: {
        type: mongoose.Schema.ObjectId,
      },
    },

    // 🗑️ Supprimé par (soft delete)
    deletedBy: {
      type: [mongoose.Schema.ObjectId],
      ref: 'User',
      default: [],
    },

    // ⭐ Messages importants/favoris
    starredBy: {
      type: [mongoose.Schema.ObjectId],
      ref: 'User',
      default: [],
    },

    // ✅ Statut général
    status: {
      type: String,
      enum: ['Envoyé', 'Livré', 'Lu', 'Archivé'],
      default: 'Envoyé',
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ======================================================
// 📊 INDEX
// ======================================================
internalMessageSchema.index({ sender: 1, createdAt: -1 });
internalMessageSchema.index({ recipients: 1, createdAt: -1 });
internalMessageSchema.index({ threadId: 1, createdAt: 1 });
internalMessageSchema.index({ status: 1 });
internalMessageSchema.index({ 'readBy.user': 1 });

// ======================================================
// 🎨 CHAMPS VIRTUELS
// ======================================================

// Vérifier si le message est lu par tous les destinataires
internalMessageSchema.virtual('isReadByAll').get(function() {
  return this.recipients.length === this.readBy.length;
});

// Nombre de destinataires ayant lu
internalMessageSchema.virtual('readCount').get(function() {
  return this.readBy.length;
});

// Nombre de destinataires
internalMessageSchema.virtual('recipientCount').get(function() {
  return this.recipients.length;
});

// Vérifier si c'est une réponse
internalMessageSchema.virtual('isReply').get(function() {
  return !!this.threadId;
});

// ======================================================
// 🔧 MIDDLEWARE PRE-SAVE
// ======================================================
internalMessageSchema.pre('save', function(next) {
  // Vérifier que l'expéditeur n'est pas dans les destinataires
  const senderInRecipients = this.recipients.some(
    recipientId => recipientId.toString() === this.sender.toString()
  );
  
  if (senderInRecipients) {
    return next(new Error('L\'expéditeur ne peut pas être dans les destinataires'));
  }
  
  // Mettre à jour le statut selon les lectures
  if (this.readBy.length > 0 && this.status === 'Envoyé') {
    this.status = 'Lu';
  }
  
  next();
});

// ======================================================
// 📋 MÉTHODES D'INSTANCE
// ======================================================

// Marquer comme lu par un utilisateur
internalMessageSchema.methods.markAsReadBy = function(userId) {
  // Vérifier si déjà lu
  const alreadyRead = this.readBy.some(
    read => read.user.toString() === userId.toString()
  );
  
  if (!alreadyRead) {
    this.readBy.push({ user: userId, readAt: Date.now() });
    this.status = 'Lu';
  }
  
  return this.save();
};

// Marquer comme non lu par un utilisateur
internalMessageSchema.methods.markAsUnreadBy = function(userId) {
  this.readBy = this.readBy.filter(
    read => read.user.toString() !== userId.toString()
  );
  
  // Si plus personne n'a lu, repasser en "Envoyé"
  if (this.readBy.length === 0) {
    this.status = 'Envoyé';
  }
  
  return this.save();
};

// Ajouter aux favoris
internalMessageSchema.methods.addStar = function(userId) {
  if (!this.starredBy.includes(userId)) {
    this.starredBy.push(userId);
  }
  return this.save();
};

// Retirer des favoris
internalMessageSchema.methods.removeStar = function(userId) {
  this.starredBy = this.starredBy.filter(
    id => id.toString() !== userId.toString()
  );
  return this.save();
};

// Supprimer pour un utilisateur (soft delete)
internalMessageSchema.methods.deleteForUser = function(userId) {
  if (!this.deletedBy.includes(userId)) {
    this.deletedBy.push(userId);
  }
  return this.save();
};

// Archiver le message
internalMessageSchema.methods.archive = function() {
  this.status = 'Archivé';
  return this.save();
};

// ======================================================
// 📋 MÉTHODES STATIQUES
// ======================================================

// Récupérer tous les messages d'un utilisateur (reçus)
internalMessageSchema.statics.getReceivedMessages = function(userId) {
  return this.find({
    recipients: userId,
    deletedBy: { $ne: userId },
  })
    .populate('sender', 'name email photo role')
    .populate('recipients', 'name email photo role')
    .sort({ createdAt: -1 });
};

// Récupérer tous les messages envoyés par un utilisateur
internalMessageSchema.statics.getSentMessages = function(userId) {
  return this.find({
    sender: userId,
    deletedBy: { $ne: userId },
  })
    .populate('sender', 'name email photo role')
    .populate('recipients', 'name email photo role')
    .sort({ createdAt: -1 });
};

// Récupérer les messages non lus d'un utilisateur
internalMessageSchema.statics.getUnreadMessages = function(userId) {
  return this.find({
    recipients: userId,
    'readBy.user': { $ne: userId },
    deletedBy: { $ne: userId },
  })
    .populate('sender', 'name email photo role')
    .sort({ createdAt: -1 });
};

// Récupérer les messages favoris d'un utilisateur
internalMessageSchema.statics.getStarredMessages = function(userId) {
  return this.find({
    starredBy: userId,
    deletedBy: { $ne: userId },
  })
    .populate('sender', 'name email photo role')
    .populate('recipients', 'name email photo role')
    .sort({ createdAt: -1 });
};

// Récupérer un fil de conversation
internalMessageSchema.statics.getThread = function(threadId) {
  return this.find({
    $or: [
      { _id: threadId },
      { threadId: threadId },
    ],
  })
    .populate('sender', 'name email photo role')
    .populate('recipients', 'name email photo role')
    .sort({ createdAt: 1 }); // Ordre chronologique pour un fil
};

// Compter les messages non lus d'un utilisateur
internalMessageSchema.statics.countUnread = async function(userId) {
  return this.countDocuments({
    recipients: userId,
    'readBy.user': { $ne: userId },
    deletedBy: { $ne: userId },
  });
};

// Récupérer les conversations récentes d'un utilisateur
internalMessageSchema.statics.getRecentConversations = async function(userId, limit = 10) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { sender: mongoose.Types.ObjectId(userId) },
          { recipients: mongoose.Types.ObjectId(userId) },
        ],
        deletedBy: { $ne: mongoose.Types.ObjectId(userId) },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ['$sender', mongoose.Types.ObjectId(userId)] },
            { $arrayElemAt: ['$recipients', 0] },
            '$sender',
          ],
        },
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: [mongoose.Types.ObjectId(userId), '$recipients'] },
                  { $not: { $in: [mongoose.Types.ObjectId(userId), '$readBy.user'] } },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $limit: limit,
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'contact',
      },
    },
    {
      $unwind: '$contact',
    },
    {
      $project: {
        contact: {
          _id: 1,
          name: 1,
          email: 1,
          photo: 1,
          role: 1,
        },
        lastMessage: 1,
        unreadCount: 1,
      },
    },
  ]);
};

// ======================================================
// 🚀 EXPORT
// ======================================================
const InternalMessage = mongoose.model('InternalMessage', internalMessageSchema);
module.exports = InternalMessage;