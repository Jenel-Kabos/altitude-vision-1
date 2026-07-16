const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  nom:            { type: String },
  url:            { type: String },
  type:           { type: String },
  dateGeneration: { type: Date, default: Date.now },
  envoiEmail:     { type: Boolean, default: false },
  dateEnvoi:      { type: Date },
});

const pieceEdlSchema = new mongoose.Schema({
  nom:          { type: String, trim: true },
  etat:         { type: String, enum: ['Neuf', 'Très bon', 'Bon', 'Moyen', 'Mauvais', 'Très mauvais'] },
  observations: { type: String, trim: true },
}, { _id: false });

const etatDesLieuxSchema = new mongoose.Schema({
  type:        { type: String, enum: ['entree', 'sortie'], required: true },
  date:        { type: Date, default: Date.now },
  pieces:      [pieceEdlSchema],
  documentUrl: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  validatedByStaff: { type: Boolean, default: false },
  validatedAt: Date,
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  degradationReported: { type: Boolean, default: false },
  maintenanceRequired: { type: Boolean, default: false },
  blockingReason: { type: String, trim: true, maxlength: 1000 },
}, { _id: false });

const contratSchema = new mongoose.Schema({
  // ─── Communs ───────────────────────────────────────────────
  type: {
    type: String,
    enum: ['location', 'vente'],
    required: [true, 'Le type de contrat est requis'],
  },
  bien:         { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  proprietaire: { type: mongoose.Schema.Types.ObjectId, ref: 'Proprietaire' },
  statut: {
    type: String,
    enum: ['actif', 'résilié', 'expiré', 'en_attente'],
    default: 'en_attente',
  },
  adresseBien:  { type: String, trim: true },
  villeBien:    { type: String, trim: true },
  documents:      [documentSchema],
  etatsDesLieux:  [etatDesLieuxSchema],
  notes:          { type: String, trim: true },

  // ─── Location ──────────────────────────────────────────────
  locataire:          { type: mongoose.Schema.Types.ObjectId, ref: 'Locataire' },
  dateEntree:         { type: Date },
  dateSortie:         { type: Date },
  dateFinBail:        { type: Date },
  montantLoyer:       { type: Number, min: 0 },
  montantCaution:     { type: Number, min: 0 },
  cautionVersee:      { type: Boolean, default: false },
  dateCautionVersee:  { type: Date },
  dureePreavis:       { type: Number, default: 1 }, // mois
  indexationAnnuelle: { type: Boolean, default: false },
  chargesIncluses:    { type: Boolean, default: false },
  montantCharges:     { type: Number, min: 0 },

  // ─── Vente ─────────────────────────────────────────────────
  acheteur: {
    nom:       { type: String, trim: true },
    prenom:    { type: String, trim: true },
    email:     { type: String, trim: true },
    telephone: { type: String, trim: true },
  },
  prixVente:               { type: Number, min: 0 },
  dateSignatureCompromis:  { type: Date },
  dateSignatureActe:       { type: Date },
  notaire: {
    nom:       { type: String, trim: true },
    telephone: { type: String, trim: true },
    email:     { type: String, trim: true },
  },
  commissionAgence:      { type: Number, min: 0 },
  conditionsSuspensives: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Contrat', contratSchema);
