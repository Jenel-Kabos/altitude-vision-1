// server/models/Litige.js
const mongoose = require('mongoose');
const privateAssetSchema = require('./schemas/privateAssetSchema');

const proofSchema = new mongoose.Schema({
  url: String,
  asset: { type: privateAssetSchema },
  nom: String,
  type: String,
  dateAjout: { type: Date, default: Date.now },
}, { _id: true });

const litigeSchema = new mongoose.Schema({
  reference: { type: String },

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

  preuves: [proofSchema],

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

  // Consultation indépendante du statut métier : un litige peut rester ouvert
  // sans devoir maintenir un badge staff.
  staffViewedAt: { type: Date, default: null, index: true },

  dateOuverture:   { type: Date, default: Date.now },
  dateDerniereMaj: Date,
}, { timestamps: true });

// Les créations API reçoivent une référence métier, mais les ressources
// historiques/legacy peuvent légitimement ne pas en avoir. L'unicité porte
// donc uniquement sur les vraies valeurs textuelles, jamais sur null/absent.
litigeSchema.index(
  { reference: 1 },
  { unique: true, name: 'reference_1', partialFilterExpression: { reference: { $type: 'string' } } },
);

litigeSchema.set('toJSON', { transform: (_doc, ret) => {
  ret.preuves = (ret.preuves || []).map(({ url, asset, ...metadata }, index) => ({ ...metadata,
    canPreview: Boolean(url || asset), canDownload: Boolean(url || asset), legacy: Boolean(url && !asset),
    previewEndpoint: `/api/litiges/${ret._id}/proofs/${index}`, downloadEndpoint: `/api/litiges/${ret._id}/proofs/${index}?download=1` }));
  return ret;
} });

module.exports = mongoose.model('Litige', litigeSchema);
