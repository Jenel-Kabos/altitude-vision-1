const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const pendingRegistrationSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // déjà hashé avant stockage
    // Défense en profondeur : une inscription publique ne peut jamais
    // transporter un rôle staff jusqu'à la création du User vérifié.
    role:     { type: String, enum: ['Client', 'Proprietaire'], default: 'Client' },
    phone:    { type: String, trim: true },
    ipInscription: { type: String },

    // Champs spécifiques Proprietaire (si applicable)
    contratAccepte:       Boolean,
    informationsVraies:   Boolean,
    estProprietaireLegal: Boolean,
    engagementHonnetete:  Boolean,
    commissionAcceptee:   Boolean,

    verificationToken: { type: String, required: true }, // hashé sha256
    expiresAt: {
      type:     Date,
      required: true,
      default:  () => Date.now() + 24 * 60 * 60 * 1000, // 24h
    },
  },
  { timestamps: true }
);

// TTL natif MongoDB — suppression automatique à expiresAt,
// pas besoin de cron
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index unique sur email pour permettre le upsert/remplacement
pendingRegistrationSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);
