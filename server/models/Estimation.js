const mongoose = require('mongoose');

const estimationSchema = new mongoose.Schema({
  // Le bien
  typeBien:      { type: String, required: true },
  transaction:   { type: String, enum: ['vente', 'location'], default: 'vente' },
  adresse:       { type: String, required: true },
  surface:       { type: Number, required: true },
  chambres:      { type: Number },
  etat:          { type: String },
  disponibilite: { type: String },
  description:   { type: String },
  // Contact
  nom:           { type: String, required: true },
  email:         { type: String, required: true },
  telephone:     { type: String },
  // Gestion
  statut: {
    type: String,
    enum: ['En attente', 'En cours', 'Traitée', 'Annulée'],
    default: 'En attente',
  },
  noteInterne:   { type: String, default: '' },
  traitePar:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  staffViewedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Estimation', estimationSchema);
