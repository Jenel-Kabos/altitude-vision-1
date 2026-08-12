const mongoose = require('mongoose');
const privateAssetSchema = require('./schemas/privateAssetSchema');

const proofSchema = new mongoose.Schema({
  url: String,
  asset: { type: privateAssetSchema },
  nom: String,
  type: String,
  dateAjout: { type: Date, default: Date.now },
}, { _id: true });

const signalementSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    signalePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    raison: {
      type: String,
      required: true,
      enum: ['prix_incorrect', 'annonce_expiree', 'photos_trompeuses', 'fraude', 'contenu_inapproprie', 'autre'],
    },
    details: { type: String, maxlength: 500, default: '' },
    preuves: [proofSchema],
    statut: {
      type: String,
      enum: ['en_attente', 'traite', 'rejete'],
      default: 'en_attente',
    },
    traitePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    traiteAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

// Un utilisateur ne peut signaler qu'une fois la même annonce
signalementSchema.index({ property: 1, signalePar: 1 }, { unique: true });
signalementSchema.set('toJSON', { transform: (_doc, ret) => {
  ret.preuves = (ret.preuves || []).map(({ url, asset, ...metadata }, index) => ({ ...metadata,
    canPreview: Boolean(url || asset), canDownload: Boolean(url || asset), legacy: Boolean(url && !asset),
    previewEndpoint: `/api/signalements/${ret._id}/proofs/${index}`, downloadEndpoint: `/api/signalements/${ret._id}/proofs/${index}?download=1` }));
  return ret;
} });

module.exports = mongoose.model('Signalement', signalementSchema);
