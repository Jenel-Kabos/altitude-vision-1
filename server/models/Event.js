// server/models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Le nom de l'événement est obligatoire."],
    trim: true,
    minlength: [3, "Le nom doit contenir au moins 3 caractères."]
  },
  description: {
    type: String,
    required: [true, "La description de l'événement est obligatoire."],
    trim: true,
  },
  about: {
    type: String,
    trim: true,
  },
  missions: {
    type: [String],
    default: []
  },
  // 🆕 NOUVEAUX CHAMPS DÉTAILLÉS
  guests: {
    type: Number,
    min: [1, "Le nombre d'invités doit être au moins 1."],
  },
  objective: {
    type: String,
    trim: true,
  },
  creativeConcept: {
    type: String,
    trim: true,
  },
  realization: {
    type: String,
    trim: true,
  },
  result: {
    type: String,
    trim: true,
  },
  date: {
    type: Date,
    required: [true, "La date de l'événement est obligatoire."],
  },
  location: {
    type: String,
    required: [true, "Le lieu de l'événement est obligatoire."],
    trim: true,
  },
  category: {
    type: String,
    enum: ['Événement', 'Mariage', 'Gala', 'Conférence', 'Anniversaire', 'Lancement', 'Autre'],
    default: 'Événement',
  },
  images: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.every(url => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        });
      },
      message: 'Une ou plusieurs URLs d\'image sont invalides'
    }
  },
  // CHAMP VIDÉOS
  videos: {
    type: [String],
    default: [],
    validate: [
      {
        validator: function(v) {
          return v.length <= 3;
        },
        message: 'Maximum 3 vidéos autorisées par événement'
      },
      {
        validator: function(v) {
          return v.every(url => {
            try {
              new URL(url);
              return true;
            } catch {
              return false;
            }
          });
        },
        message: 'Une ou plusieurs URLs de vidéo sont invalides'
      }
    ]
  },
  status: {
    type: String,
    enum: ['Brouillon', 'Publié', 'Archivé'],
    default: 'Publié',
  },
  featured: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ======================================================
// 📊 INDEX
// ======================================================
eventSchema.index({ date: -1 });
eventSchema.index({ status: 1, date: -1 });
eventSchema.index({ category: 1 });
eventSchema.index({ featured: 1 });

// ======================================================
// 🎨 CHAMPS VIRTUELS
// ======================================================
eventSchema.virtual('imageCount').get(function() {
  return this.images.length;
});

eventSchema.virtual('videoCount').get(function() {
  return this.videos.length;
});

eventSchema.virtual('mediaCount').get(function() {
  return this.images.length + this.videos.length;
});

eventSchema.virtual('isPast').get(function() {
  return this.date < new Date();
});

eventSchema.virtual('isUpcoming').get(function() {
  return this.date > new Date();
});

eventSchema.virtual('daysUntilEvent').get(function() {
  const now = new Date();
  const eventDate = new Date(this.date);
  const diffTime = eventDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// ======================================================
// 🔧 MIDDLEWARE PRE-SAVE
// ======================================================
eventSchema.pre('save', function(next) {
  if (this.isNew && this.date < new Date()) {
    console.warn('⚠️ Attention : Création d\'un événement avec une date passée');
  }
  
  if (this.videos && this.videos.length > 3) {
    return next(new Error('Maximum 3 vidéos autorisées par événement'));
  }
  
  next();
});

// ======================================================
// 📋 MÉTHODES D'INSTANCE
// ======================================================
eventSchema.methods.setFeatured = function() {
  this.featured = true;
  return this.save();
};

eventSchema.methods.publish = function() {
  this.status = 'Publié';
  return this.save();
};

eventSchema.methods.archive = function() {
  this.status = 'Archivé';
  return this.save();
};

eventSchema.methods.addVideo = function(videoUrl) {
  if (this.videos.length >= 3) {
    throw new Error('Maximum 3 vidéos autorisées par événement');
  }
  this.videos.push(videoUrl);
  return this.save();
};

eventSchema.methods.removeVideo = function(videoUrl) {
  this.videos = this.videos.filter(v => v !== videoUrl);
  return this.save();
};

// ======================================================
// 📋 MÉTHODES STATIQUES
// ======================================================
eventSchema.statics.getUpcomingEvents = function(limit = 10) {
  return this.find({
    date: { $gte: new Date() },
    status: 'Publié'
  })
  .sort({ date: 1 })
  .limit(limit);
};

eventSchema.statics.getFeaturedEvents = function(limit = 5) {
  return this.find({
    featured: true,
    status: 'Publié'
  })
  .sort({ date: -1 })
  .limit(limit);
};

eventSchema.statics.getByCategory = function(category) {
  return this.find({
    category,
    status: 'Publié'
  }).sort({ date: -1 });
};

eventSchema.statics.getEventsWithVideos = function() {
  return this.find({
    videos: { $exists: true, $ne: [] },
    status: 'Publié'
  }).sort({ date: -1 });
};

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;