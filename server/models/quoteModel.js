import mongoose from 'mongoose';

/**
 * ================================
 *  Modèle : Quote
 *  Description :
 *  Gère les devis demandés par des clients pour des services
 *  ou projets de l’agence.
 * ================================
 */

const quoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Le client est requis.'],
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Le service concerné est requis.'],
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    description: {
      type: String,
      required: [true, 'La description du devis est requise.'],
    },
    estimatedAmount: {
      type: Number,
      required: [true, 'Le montant estimé est requis.'],
      min: 0,
    },
    status: {
      type: String,
      enum: ['En attente', 'Accepté', 'Refusé', 'Annulé'],
      default: 'En attente',
    },
    attachments: [
      {
        name: { type: String },
        url: { type: String },
      },
    ],
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Quote = mongoose.models.Quote || mongoose.model('Quote', quoteSchema);

export default Quote;
