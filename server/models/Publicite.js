const mongoose = require('mongoose');

const publiciteSchema = new mongoose.Schema(
  {
    titre: {
      type: String,
      required: [true, 'Un titre est requis pour la publicité'],
      trim: true,
    },
    media: {
      type: String,
      required: [true, 'Une URL de média (image ou GIF) est requise'],
    },
    type: {
      type: String,
      enum: ['image', 'gif'],
      default: 'image',
    },
    lien: {
      type: String,
      default: null,
    },
    actif: {
      type: Boolean,
      default: true,
    },
    ordre: {
      type: Number,
      default: 0,
    },
    pole: {
      type: String,
      enum: ['Altimmo', 'MilaEvents', 'Altcom'],
      default: 'Altimmo',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Publicite', publiciteSchema);
