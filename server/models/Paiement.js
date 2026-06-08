const mongoose = require('mongoose');

const paiementSchema = new mongoose.Schema({
  contrat:     { type: mongoose.Schema.Types.ObjectId, ref: 'Contrat', required: true },
  mois:        { type: Number, min: 1, max: 12 },
  annee:       { type: Number },
  montant:     { type: Number, min: 0 },
  datePaiement:{ type: Date },
  statut: {
    type: String,
    enum: ['payé', 'en_retard', 'impayé', 'partiel'],
    default: 'impayé',
  },
  modePaiement: {
    type: String,
    enum: ['espèces', 'virement', 'chèque', 'mobile'],
  },
  reference: { type: String, trim: true },
  notes:     { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Paiement', paiementSchema);
