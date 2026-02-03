// server/models/Comment.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Un commentaire doit avoir un auteur']
  },
  targetType: {
    type: String,
    required: [true, 'Le type de cible est requis'],
    enum: ['Property', 'Event', 'Service'],
  },
  targetId: {
    type: mongoose.Schema.ObjectId,
    required: [true, 'L\'ID de la cible est requis'],
    refPath: 'targetType'
  },
  content: {
    type: String,
    required: [true, 'Le contenu du commentaire est requis'],
    trim: true,
    minlength: [3, 'Le commentaire doit contenir au moins 3 caractères'],
    maxlength: [1000, 'Le commentaire ne peut pas dépasser 1000 caractères']
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour optimiser les requêtes
commentSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
commentSchema.index({ author: 1 });

// Méthode statique pour compter les commentaires
commentSchema.statics.countComments = function(targetType, targetId) {
  return this.countDocuments({ targetType, targetId });
};

// Méthode statique pour obtenir les commentaires d'un élément
commentSchema.statics.getComments = function(targetType, targetId, options = {}) {
  const { limit = 20, skip = 0, sort = '-createdAt' } = options;
  
  return this.find({ targetType, targetId })
    .populate('author', 'name email avatar')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// Méthode d'instance pour éditer un commentaire
commentSchema.methods.editComment = function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

const Comment = mongoose.model('Comment', commentSchema);
module.exports = Comment;