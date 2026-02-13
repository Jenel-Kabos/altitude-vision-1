const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    rating: {
      type: Number,
      min: [1, 'La note minimale est 1'],
      max: [5, 'La note maximale est 5'],
      required: [true, 'Une review doit avoir une note.'],
    },
    comment: {
      type: String,
      trim: true,
      required: [true, 'Une review doit contenir un commentaire.'],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Une review doit appartenir à un auteur.'],
    },
    // ✅ NOUVEAU : La review concerne un pôle (Altimmo, Mila Events, Altcom)
    pole: {
      type: String,
      enum: ['Altimmo', 'MilaEvents', 'Altcom'],
      required: [true, 'Une review doit être liée à un pôle.'],
    },
    // ✅ NOUVEAU : Réponse de l'administrateur (optionnelle)
    adminResponse: {
      text: {
        type: String,
        trim: true,
        default: null,
      },
      respondedAt: {
        type: Date,
        default: null,
      },
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Index unique : un utilisateur ne peut laisser qu'un seul avis par pôle
reviewSchema.index({ pole: 1, author: 1 }, { unique: true });

// ✅ Pré-remplissage automatique des infos auteur pour toutes les queries "find"
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'author',
    select: 'name photo email',
  }).populate({
    path: 'adminResponse.respondedBy',
    select: 'name photo',
  });
  next();
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;