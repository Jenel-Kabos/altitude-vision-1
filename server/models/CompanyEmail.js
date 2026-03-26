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
      unique: true,       // ← crée déjà l'index email_1 automatiquement
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._-]+@altitudevision\.(cg|agency)$/,
        'L\'adresse doit se terminer par @altitudevision.cg ou @altitudevision.agency',
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
        'Autre',
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
      quotes:          { type: Boolean, default: false },
      contactMessages: { type: Boolean, default: false },
      systemAlerts:    { type: Boolean, default: false },
      properties:      { type: Boolean, default: false },
      events:          { type: Boolean, default: false },
    },

    // ✅ Statut actif/inactif
    isActive: {
      type: Boolean,
      default: true,
    },

    // 🔐 Mot de passe de l'email (select: false pour sécurité)
    password: {
      type: String,
      select: false,
    },

    // ⚙️ Configuration SMTP (avec valeurs par défaut)
    smtpConfig: {
      host:   { type: String,  default: 'mail.privateemail.com' },
      port:   { type: Number,  default: 465 },
      secure: { type: Boolean, default: true },
    },

    // 📊 Statistiques
    stats: {
      emailsSent:     { type: Number, default: 0 },
      emailsReceived: { type: Number, default: 0 },
      lastUsed:       { type: Date,   default: Date.now },
    },

    // 🧾 Créé par (admin)
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ======================================================
// 📊 INDEX
// ✅ email n'est PAS répété ici car unique:true le crée déjà
// ======================================================
companyEmailSchema.index({ emailType:   1 });
companyEmailSchema.index({ assignedTo:  1 });
companyEmailSchema.index({ isActive:    1 });

// ======================================================
// 🎨 CHAMPS VIRTUELS
// ======================================================
companyEmailSchema.virtual('username').get(function () {
  return this.email.split('@')[0];
});

companyEmailSchema.virtual('hasNotifications').get(function () {
  return Object.values(this.notifications).some(v => v === true);
});

// ======================================================
// 🔧 MIDDLEWARE PRE-SAVE
// ======================================================
companyEmailSchema.pre('save', function (next) {
  if (this.isModified('stats.emailsSent') || this.isModified('stats.emailsReceived')) {
    this.stats.lastUsed = Date.now();
  }
  next();
});

// ======================================================
// 📋 MÉTHODES D'INSTANCE
// ======================================================

companyEmailSchema.methods.activate = function () {
  this.isActive = true;
  return this.save();
};

companyEmailSchema.methods.deactivate = function () {
  this.isActive = false;
  return this.save();
};

companyEmailSchema.methods.incrementSent = function () {
  this.stats.emailsSent += 1;
  this.stats.lastUsed = Date.now();
  return this.save();
};

companyEmailSchema.methods.incrementReceived = function () {
  this.stats.emailsReceived += 1;
  this.stats.lastUsed = Date.now();
  return this.save();
};

// ======================================================
// 📋 MÉTHODES STATIQUES
// ======================================================

companyEmailSchema.statics.getActiveEmails = function () {
  return this.find({ isActive: true })
    .populate('assignedTo', 'name email role photo')
    .populate('createdBy',  'name email')
    .sort({ createdAt: -1 });
};

companyEmailSchema.statics.getByType = function (emailType) {
  return this.find({ emailType, isActive: true })
    .populate('assignedTo', 'name email role photo')
    .sort({ createdAt: -1 });
};

companyEmailSchema.statics.getAssignedTo = function (userId) {
  return this.find({ assignedTo: userId, isActive: true })
    .populate('assignedTo', 'name email role photo')
    .sort({ createdAt: -1 });
};

companyEmailSchema.statics.getQuoteNotificationEmails = function () {
  return this.find({ 'notifications.quotes': true, isActive: true })
    .populate('assignedTo', 'name email photo')
    .select('email displayName assignedTo');
};

companyEmailSchema.statics.getContactNotificationEmails = function () {
  return this.find({ 'notifications.contactMessages': true, isActive: true })
    .populate('assignedTo', 'name email photo')
    .select('email displayName assignedTo');
};

companyEmailSchema.statics.emailExists = async function (email) {
  const count = await this.countDocuments({ email: email.toLowerCase() });
  return count > 0;
};

companyEmailSchema.statics.getGlobalStats = async function () {
  const result = await this.aggregate([
    {
      $group: {
        _id:            null,
        totalEmails:    { $sum: 1 },
        activeEmails:   { $sum: { $cond: ['$isActive', 1, 0] } },
        totalSent:      { $sum: '$stats.emailsSent' },
        totalReceived:  { $sum: '$stats.emailsReceived' },
      },
    },
  ]);

  return result[0] || {
    totalEmails:   0,
    activeEmails:  0,
    totalSent:     0,
    totalReceived: 0,
  };
};

// ======================================================
// 🚀 EXPORT
// ======================================================
const CompanyEmail = mongoose.model('CompanyEmail', companyEmailSchema);
module.exports = CompanyEmail;