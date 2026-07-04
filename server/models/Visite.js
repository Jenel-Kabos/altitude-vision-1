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
  statut: {
    type: String,
    enum: ['En attente', 'Confirmée', 'En cours', 'Terminée', 'Annulée'],
    default: 'En attente',
  },
  notes: { type: String, default: '' },          // notes internes staff
  traitePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('Visite', visiteSchema);
