const mongoose = require('mongoose');

const signalementSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    signalePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    raison: {
      type: String,
      required: true,
      enum: ['prix_incorrect', 'annonce_expiree', 'photos_trompeuses', 'fraude', 'contenu_inapproprie', 'autre'],
    },
    details: { type: String, maxlength: 500, default: '' },
    preuves: [{
      url:       String,
      nom:       String,
      type:      String,
      dateAjout: { type: Date, default: Date.now },
    }],
    statut: {
      type: String,
      enum: ['en_attente', 'traite', 'rejete'],
      default: 'en_attente',
    },
    traitePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    traiteAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

// Un utilisateur ne peut signaler qu'une fois la même annonce
signalementSchema.index({ property: 1, signalePar: 1 }, { unique: true });

module.exports = mongoose.model('Signalement', signalementSchema);
