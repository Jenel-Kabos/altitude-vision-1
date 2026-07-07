const mongoose = require('mongoose');

const devisSchema = new mongoose.Schema({
  // Contact
  nom:           { type: String, required: true, trim: true },
  email:         { type: String, required: true, trim: true },
  telephone:     { type: String, trim: true },
  // Bien
  adresseBien:   { type: String, required: true, trim: true },
  typeBien:      { type: String, required: true },
  surface:       { type: Number },
  loyerSouhaite: { type: Number },
  nbBiens:       { type: Number, default: 1 },
  message:       { type: String, trim: true },
  // Gestion
  statut: {
    type: String,
    enum: ['En attente', 'En cours', 'Traité', 'Annulé'],
    default: 'En attente',
  },
  noteInterne:  { type: String, default: '' },
  traitePar:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Devis', devisSchema);
