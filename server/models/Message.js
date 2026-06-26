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
    required: false, // null pour les messages vers la boîte staff partagée
    default: null,
  },
  // Lien explicite vers la Conversation (obligatoire pour staff-inbox, optionnel en 1-à-1)
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    default: null,
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
  isStarred: {
    type: Boolean,
    default: false,
  },
  attachments: [
    {
      filename: { type: String, required: true },
      filepath: { type: String, required: true },
      mimetype: { type: String },
      size: { type: Number },
    },
  ],
}, {
  timestamps: true,
});

// Index pour performances
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ receiver: 1, isStarred: 1 });
messageSchema.index({ conversation: 1, createdAt: 1 }); // pour staff-inbox

module.exports = mongoose.model('Message', messageSchema);
