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
    maxlength: 5000,
    default: '',
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
  attachments: [{
    url:      { type: String, required: true },
    type:     { type: String, enum: ['image', 'video', 'audio', 'file'], required: true },
    nom:      { type: String },
    size:     { type: Number },
    duration: { type: Number }, // pour audio/vidéo, en secondes
  }],
}, {
  timestamps: true,
});

messageSchema.pre('save', function(next) {
  if (!this.content && (!this.attachments || this.attachments.length === 0)) {
    return next(new Error('Message vide : content ou attachments requis'));
  }
  next();
});

// Index pour performances
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ receiver: 1, isStarred: 1 });
messageSchema.index({ conversation: 1, createdAt: 1 }); // pour staff-inbox

module.exports = mongoose.model('Message', messageSchema);
