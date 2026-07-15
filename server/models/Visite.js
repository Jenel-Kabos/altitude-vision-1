const mongoose = require('mongoose');

const visiteSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    default: null,
  },
  dateProposee: { type: Date, default: null },   // proposée par le staff
  dateConfirmee: { type: Date, default: null },  // validée finale
  datePreferee:  { type: String, default: '' },  // saisie libre du client (JJ/MM/AAAA)
  heurePreferee: { type: String, default: '' },  // saisie libre du client (HH:MM)
  telephone:     { type: String, default: '' },  // contact du client pour cette demande
  message:       { type: String, default: '' },  // précisions du client
  statut: {
    type: String,
    enum: ['En attente', 'Confirmée', 'En cours', 'Terminée', 'Annulée'],
    default: 'En attente',
  },
  notes: { type: String, default: '' },          // notes internes staff
  paiementStatus: {
    type: String,
    enum: ['non_requis', 'en_attente', 'payé', 'exempté'],
    default: 'non_requis',
  },
  paiementRef: { type: String, default: null },  // référence YabetooPay intent ID
  traitePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  staffViewedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Visite', visiteSchema);
