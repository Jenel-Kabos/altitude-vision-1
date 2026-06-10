// server/models/Litige.js
const mongoose = require('mongoose');

const litigeSchema = new mongoose.Schema({
  reference: { type: String, unique: true },

  type: {
    type: String,
    enum: ['Information_fausse', 'Bien_inexistant', 'Prix_non_respecté', 'Arnaque', 'Mauvaise_foi', 'Problème_paiement', 'Autre'],
    required: [true, 'Le type de litige est requis'],
  },

  statut: {
    type: String,
    enum: ['Ouvert', 'En_cours_médiation', 'Résolu', 'Escaladé', 'Fermé'],
    default: 'Ouvert',
  },

  priorité: {
    type: String,
    enum: ['Faible', 'Normale', 'Haute', 'Urgente'],
    default: 'Normale',
  },

  plaignant: {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nom:       String,
    email:     String,
    telephone: String,
    type:      { type: String, enum: ['Client', 'Propriétaire'] },
  },

  accusé: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nom:    String,
    email:  String,
    type:   { type: String, enum: ['Client', 'Propriétaire', 'Plateforme'] },
  },

  bienConcerné: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },

  description: { type: String, required: [true, 'La description est requise'] },

  preuves: [{
    url:       String,
    nom:       String,
    type:      String,
    dateAjout: { type: Date, default: Date.now },
  }],

  timeline: [{
    action: String,
    auteur: String,
    role:   String,
    date:   { type: Date, default: Date.now },
    note:   String,
  }],

  resolution: {
    decision:       String,
    dateResolution: Date,
    resolvedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },

  dateOuverture:   { type: Date, default: Date.now },
  dateDerniereMaj: Date,
}, { timestamps: true });

module.exports = mongoose.model('Litige', litigeSchema);
