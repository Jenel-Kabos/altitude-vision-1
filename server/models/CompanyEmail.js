// server/models/CompanyEmail.js
const mongoose = require('mongoose');

// ======================================================
// 🧩 SCHEMA EMAIL PROFESSIONNEL ALTITUDE VISION
// ======================================================
const companyEmailSchema = new mongoose.Schema(
  {
    // 📧 Adresse email complète
    email: {
      type: String,
      required: [true, 'Une adresse email est requise.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._-]+@altitudevision\.cg$/,
        'L\'adresse doit se terminer par @altitudevision.cg',
      ],
    },

    // 👤 Nom/alias de l'adresse (ex: "Contact", "Support", "Devis")
    displayName: {
      type: String,
      required: [true, 'Un nom d\'affichage est requis.'],
      trim: true,
      maxlength: [50, 'Le nom ne doit pas dépasser 50 caractères.'],
    },

    // 🏷️ Type d'adresse
    emailType: {
      type: String,
      enum: [
        'Contact Général',
        'Devis & Commercial',
        'Support Technique',
        'Administration',
        'Marketing',
        'Événementiel',
        'Immobilier',
        'Personnel',
        'Autre'
      ],
      default: 'Contact Général',
    },

    // 📝 Description / Usage
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'La description ne doit pas dépasser 200 caractères.'],
    },

    // 👥 Collaborateur assigné (référence au User)
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },

    // 📩 Notifications activées
    notifications: {
      // Recevoir les demandes de devis
      quotes: {
        type: Boolean,
        default: false,
      },
      // Recevoir les messages de contact
      contactMessages: {
        type: Boolean,
        default: false,
      },
      // Recevoir les notifications système
      systemAlerts: {
        type: Boolean,
        default: false,
      },
      // Recevoir les notifications de propriétés
      properties: {
        type: Boolean,
        default: false,
      },
      // Recevoir les notifications d'événements
      events: {
        type: Boolean,
        default: false,
      },
    },

    // ✅ Statut actif/inactif
    isActive: {
      type: Boolean,
      default: true,
    },

    // 🔐 Mot de passe de l'email (crypté, pour config SMTP)
    password: {
      type: String,
      select: false, // Ne pas renvoyer par défaut
    },

    // ⚙️ Configuration SMTP (optionnel)
    smtpConfig: {
      host: String,
      port: Number,
      secure: Boolean,
    },

    // 📊 Statistiques
    stats: {
      emailsSent: {
        type: Number,
        default: 0,
      },
      emailsReceived: {
        type: Number,
        default: 0,
      },
      lastUsed: Date,
    },

    // 🧾 Créé par (admin)
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ======================================================
// 📊 INDEX
// ======================================================
companyEmailSchema.index({ email: 1 });
companyEmailSchema.index({ emailType: 1 });
companyEmailSchema.index({ assignedTo: 1 });
companyEmailSchema.index({ isActive: 1 });

// ======================================================
// 🎨 CHAMPS VIRTUELS
// ======================================================
companyEmailSchema.virtual('username').get(function() {
  return this.email.split('@')[0];
});

companyEmailSchema.virtual('hasNotifications').get(function() {
  return Object.values(this.notifications).some(value => value === true);
});

// ======================================================
// 🔧 MIDDLEWARE PRE-SAVE
// ======================================================
companyEmailSchema.pre('save', function(next) {
  // Vérifier que l'email se termine bien par @altitudevision.cg
  if (!this.email.endsWith('@altitudevision.cg')) {
    return next(new Error('L\'adresse doit se terminer par @altitudevision.cg'));
  }
  
  // Mettre à jour lastUsed si des emails ont été envoyés
  if (this.stats.emailsSent > 0 || this.stats.emailsReceived > 0) {
    this.stats.lastUsed = Date.now();
  }
  
  next();
});

// ======================================================
// 📋 MÉTHODES D'INSTANCE
// ======================================================

// Activer l'email
companyEmailSchema.methods.activate = function() {
  this.isActive = true;
  return this.save();
};

// Désactiver l'email
companyEmailSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Incrémenter le compteur d'emails envoyés
companyEmailSchema.methods.incrementSent = function() {
  this.stats.emailsSent += 1;
  this.stats.lastUsed = Date.now();
  return this.save();
};

// Incrémenter le compteur d'emails reçus
companyEmailSchema.methods.incrementReceived = function() {
  this.stats.emailsReceived += 1;
  this.stats.lastUsed = Date.now();
  return this.save();
};

// Activer une notification spécifique
companyEmailSchema.methods.enableNotification = function(type) {
  if (this.notifications.hasOwnProperty(type)) {
    this.notifications[type] = true;
    return this.save();
  }
  throw new Error(`Type de notification invalide: ${type}`);
};

// Désactiver une notification spécifique
companyEmailSchema.methods.disableNotification = function(type) {
  if (this.notifications.hasOwnProperty(type)) {
    this.notifications[type] = false;
    return this.save();
  }
  throw new Error(`Type de notification invalide: ${type}`);
};

// ======================================================
// 📋 MÉTHODES STATIQUES
// ======================================================

// Récupérer tous les emails actifs
companyEmailSchema.statics.getActiveEmails = function() {
  return this.find({ isActive: true })
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
};

// Récupérer les emails par type
companyEmailSchema.statics.getByType = function(emailType) {
  return this.find({ emailType, isActive: true })
    .populate('assignedTo', 'name email role')
    .sort({ createdAt: -1 });
};

// Récupérer les emails assignés à un collaborateur
companyEmailSchema.statics.getAssignedTo = function(userId) {
  return this.find({ assignedTo: userId, isActive: true })
    .sort({ createdAt: -1 });
};

// Récupérer les emails recevant les notifications de devis
companyEmailSchema.statics.getQuoteNotificationEmails = function() {
  return this.find({ 
    'notifications.quotes': true, 
    isActive: true 
  })
  .populate('assignedTo', 'name email')
  .select('email displayName assignedTo');
};

// Récupérer les emails recevant les notifications de contact
companyEmailSchema.statics.getContactNotificationEmails = function() {
  return this.find({ 
    'notifications.contactMessages': true, 
    isActive: true 
  })
  .populate('assignedTo', 'name email')
  .select('email displayName assignedTo');
};

// Vérifier si un email existe déjà
companyEmailSchema.statics.emailExists = async function(email) {
  const count = await this.countDocuments({ email: email.toLowerCase() });
  return count > 0;
};

// Obtenir les statistiques globales
companyEmailSchema.statics.getGlobalStats = async function() {
  const result = await this.aggregate([
    {
      $group: {
        _id: null,
        totalEmails: { $sum: 1 },
        activeEmails: { 
          $sum: { $cond: ['$isActive', 1, 0] } 
        },
        totalSent: { $sum: '$stats.emailsSent' },
        totalReceived: { $sum: '$stats.emailsReceived' },
      },
    },
  ]);
  
  return result[0] || {
    totalEmails: 0,
    activeEmails: 0,
    totalSent: 0,
    totalReceived: 0,
  };
};

// ======================================================
// 🚀 EXPORT
// ======================================================
const CompanyEmail = mongoose.model('CompanyEmail', companyEmailSchema);
module.exports = CompanyEmail;