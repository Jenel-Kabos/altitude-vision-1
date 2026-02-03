const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subject: {
    type: String,
    default: 'Sans objet',
  },
  content: {
    type: String,
    required: [true, 'Le contenu du message est requis'],
    maxlength: 5000,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  isStarred: { // Ajout nécessaire pour la route /starred
    type: Boolean,
    default: false,
  },
  // NOUVEAU : Champ pour les pièces jointes
  attachments: [
    {
        filename: { type: String, required: true },
        filepath: { type: String, required: true },
        mimetype: { type: String },
        size: { type: Number }
    }
  ],
}, {
  timestamps: true,
});

// Index pour performances
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ receiver: 1, isStarred: 1 }); // Index pour la nouvelle route

module.exports = mongoose.model('Message', messageSchema);