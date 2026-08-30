const mongoose = require('mongoose');
const privateAssetSchema = require('./schemas/privateAssetSchema');

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
  reference:    { type: String, trim: true },
  notes:        { type: String, trim: true },
  montantRecu:  { type: Number },
  // Optionnel — les anciens documents n'ont pas ce champ, ce qui reste
  // valide (aucune contrainte required, aucune migration nécessaire).
  preuvePaiement: {
    url:      { type: String },
    publicId: { type: String },
    asset:    { type: privateAssetSchema },
  },

  // ── Retard & Pénalités ─────────────────────────────────────
  jourEcheance:      { type: Number, default: 1 },
  penaliteAppliquee: { type: Boolean, default: false },
  penaliteMontant:   { type: Number, default: 0 },
  montantTotal:      { type: Number },
  dateDebutRetard:   { type: Date },
  retardJours:       { type: Number, default: 0 },
  penaltyEmailDelivery: {
    key:       { type: String, trim: true },
    status:    { type: String, enum: ['sending', 'sent', 'unknown'] },
    claimedAt: { type: Date },
    sentAt:    { type: Date },
    error:     { type: String, maxlength: 500 },
  },
}, { timestamps: true });
paiementSchema.set('toJSON', { transform: (_doc, ret) => {
  const available = Boolean(ret.preuvePaiement?.asset || ret.preuvePaiement?.url);
  delete ret.preuvePaiement;
  if (available) ret.paymentProof = { canPreview: true, canDownload: true, previewEndpoint: `/api/paiements/${ret._id}/proof`, downloadEndpoint: `/api/paiements/${ret._id}/proof?download=1` };
  return ret;
} });

module.exports = mongoose.model('Paiement', paiementSchema);
