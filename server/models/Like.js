// server/models/Like.js
const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Un like doit avoir un utilisateur']
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
  }
}, {
  timestamps: true
});

// Index pour éviter les doublons et optimiser les requêtes
likeSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });
likeSchema.index({ targetType: 1, targetId: 1 });
likeSchema.index({ user: 1 });

// Méthode statique pour compter les likes
likeSchema.statics.countLikes = function(targetType, targetId) {
  return this.countDocuments({ targetType, targetId });
};

// Méthode statique pour vérifier si un utilisateur a liké
likeSchema.statics.hasUserLiked = async function(userId, targetType, targetId) {
  const like = await this.findOne({ user: userId, targetType, targetId });
  return !!like;
};

const Like = mongoose.model('Like', likeSchema);
module.exports = Like;