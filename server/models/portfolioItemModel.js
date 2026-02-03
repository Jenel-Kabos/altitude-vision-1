const mongoose = require('mongoose');

const portfolioItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Un titre est requis'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Une description est requise'],
      trim: true,
    },
    // Pôle fixe à Altcom
    pole: {
      type: String,
      required: true,
      enum: ['Altcom'],
      default: 'Altcom',
      immutable: true, // Ne peut pas être modifié après création
    },
    // Catégorie spécifique à Altcom uniquement
    category: {
      type: String,
      required: [true, 'La catégorie est requise'],
      enum: [
        'Communication Digitale',
        'Branding & Design',
        'Stratégie de Contenu',
        'Campagne Publicitaire',
        'Production Audiovisuelle',
        'Relations Publiques',
        'Événementiel',
        'Autre'
      ],
      default: 'Communication Digitale',
    },
    // Images du projet
    images: [
      {
        type: String,
        required: true,
      }
    ],
    // Lien vers le projet (optionnel)
    link: {
      type: String,
      trim: true,
    },
    // Date de réalisation du projet
    projectDate: {
      type: Date,
      default: Date.now,
    },
    // Client (optionnel, peut être anonymisé)
    client: {
      type: String,
      trim: true,
    },
    // Tags pour faciliter la recherche
    tags: [
      {
        type: String,
        trim: true,
      }
    ],
    // Statistiques calculées automatiquement
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    // Visibilité (pour gérer les brouillons)
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual populate pour les reviews
portfolioItemSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'portfolioItem',
  localField: '_id',
});

// Index pour optimiser les recherches (pole fixe donc pas besoin d'indexer)
portfolioItemSchema.index({ category: 1 });
portfolioItemSchema.index({ projectDate: -1 });
portfolioItemSchema.index({ averageRating: -1 });
portfolioItemSchema.index({ isPublished: 1 });
portfolioItemSchema.index({ client: 1 });

// Middleware pre-save pour forcer le pôle à Altcom
portfolioItemSchema.pre('save', function(next) {
  this.pole = 'Altcom';
  next();
});

// Middleware pre-update pour forcer le pôle à Altcom
portfolioItemSchema.pre('findOneAndUpdate', function(next) {
  this.set({ pole: 'Altcom' });
  next();
});

// Méthode statique pour calculer la note moyenne
portfolioItemSchema.statics.calcAverageRating = async function(portfolioItemId) {
  try {
    const Review = mongoose.model('Review');
    
    const stats = await Review.aggregate([
      {
        $match: { portfolioItem: mongoose.Types.ObjectId(portfolioItemId) }
      },
      {
        $group: {
          _id: '$portfolioItem',
          avgRating: { $avg: '$rating' },
          numReviews: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await this.findByIdAndUpdate(portfolioItemId, {
        averageRating: Math.round(stats[0].avgRating * 10) / 10, // Arrondi à 1 décimale
        reviewCount: stats[0].numReviews,
      });
      
      console.log(`✅ [PortfolioItem] Notes recalculées pour ${portfolioItemId}: ${stats[0].avgRating}/5 (${stats[0].numReviews} avis)`);
    } else {
      await this.findByIdAndUpdate(portfolioItemId, {
        averageRating: 0,
        reviewCount: 0,
      });
      
      console.log(`✅ [PortfolioItem] Réinitialisation des notes pour ${portfolioItemId}`);
    }
  } catch (error) {
    console.error(`❌ [PortfolioItem] Erreur calcul notes pour ${portfolioItemId}:`, error);
  }
};

// Méthode statique pour obtenir les statistiques
portfolioItemSchema.statics.getStats = async function() {
  try {
    const stats = await this.aggregate([
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          publishedProjects: {
            $sum: { $cond: [{ $eq: ['$isPublished', true] }, 1, 0] }
          },
          avgRating: { $avg: '$averageRating' },
          totalReviews: { $sum: '$reviewCount' },
        }
      }
    ]);

    return stats[0] || {
      totalProjects: 0,
      publishedProjects: 0,
      avgRating: 0,
      totalReviews: 0,
    };
  } catch (error) {
    console.error('❌ [PortfolioItem] Erreur stats:', error);
    return {
      totalProjects: 0,
      publishedProjects: 0,
      avgRating: 0,
      totalReviews: 0,
    };
  }
};

// Méthode statique pour obtenir les projets par catégorie
portfolioItemSchema.statics.getByCategory = async function() {
  try {
    return await this.aggregate([
      { $match: { isPublished: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgRating: { $avg: '$averageRating' },
        }
      },
      { $sort: { count: -1 } }
    ]);
  } catch (error) {
    console.error('❌ [PortfolioItem] Erreur getByCategory:', error);
    return [];
  }
};

const PortfolioItem = mongoose.model('PortfolioItem', portfolioItemSchema);

module.exports = PortfolioItem;