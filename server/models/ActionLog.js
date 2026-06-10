// server/models/ActionLog.js
const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
  action: {
    type:     String,
    required: true,
    trim:     true,
  },
  description: {
    type:     String,
    required: true,
    trim:     true,
  },
  module: {
    type: String,
    enum: [
      'Altimmo','MilaEvents','Altcom','GestionLocative',
      'Utilisateurs','Actualites','Portfolio','Devis',
      'Messagerie','Dashboard',
    ],
  },
  auteur: {
    id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nom:   { type: String },
    role:  { type: String },
    email: { type: String },
  },
  cible: {
    id:   { type: String },
    type: { type: String },
    nom:  { type: String },
  },
  typeAction: {
    type: String,
    enum: [
      'CRÉATION','MODIFICATION','SUPPRESSION','VALIDATION',
      'REJET','CONNEXION','DÉCONNEXION','PAIEMENT',
      'GÉNÉRATION_PDF','ENVOI_EMAIL','CHANGEMENT_RÔLE','UPLOAD_PHOTO',
    ],
  },
  metadata: {
    ancienneValeur: { type: String },
    nouvelleValeur: { type: String },
    ip:             { type: String },
    userAgent:      { type: String },
  },
  date: {
    type:    Date,
    default: Date.now,
  },
});

actionLogSchema.index({ date:        -1            });
actionLogSchema.index({ module:       1, date: -1  });
actionLogSchema.index({ typeAction:   1, date: -1  });
actionLogSchema.index({ 'auteur.id':  1, date: -1  });

module.exports = mongoose.model('ActionLog', actionLogSchema);
