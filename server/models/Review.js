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
    // La review concerne un élément spécifique du portfolio
    portfolioItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PortfolioItem',
      required: [true, 'Une review doit être liée à un élément du portfolio.'],
    },
  },
  {
    timestamps: true,
  }
);

// Index unique pour empêcher qu’un même utilisateur laisse plusieurs reviews sur le même portfolioItem
reviewSchema.index({ portfolioItem: 1, author: 1 }, { unique: true });

// Pré-remplissage automatique des infos auteur pour toutes les queries "find"
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'author',
    select: 'name photo', // On ne récupère que le nom et la photo de l’auteur
  });
  next();
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
