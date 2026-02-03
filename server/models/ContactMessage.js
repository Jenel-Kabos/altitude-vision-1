const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "L'email est requis"],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
  },
  subject: {
    type: String,
    required: [true, 'Le sujet est requis'],
    trim: true,
  },
  message: {
    type: String,
    required: [true, 'Le message est requis'],
    maxlength: [2000, 'Le message ne peut pas dépasser 2000 caractères'],
  },
  status: {
    type: String,
    enum: ['Non lu', 'Lu', 'En cours', 'Traité', 'Archivé'],
    default: 'Non lu',
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  responseNote: {
    type: String,
  },
  respondedAt: {
    type: Date,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index pour recherche rapide
contactMessageSchema.index({ email: 1, submittedAt: -1 });
contactMessageSchema.index({ status: 1 });
contactMessageSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);