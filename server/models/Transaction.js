const mongoose = require('mongoose');
const { Schema } = mongoose;
const ObjectId  = Schema.Types.ObjectId;

const transactionSchema = new Schema(
  {
    property: { type: ObjectId, ref: 'Property', required: true },
    client:   { type: ObjectId, ref: 'User',     required: true },
    agent:    { type: ObjectId, ref: 'User',     required: true },
    reservation: { type: ObjectId, ref: 'RealEstateReservation', required: true, unique: true },

    finalAmount: { type: Number, required: true, min: 0 },
    transactionType: {
      type: String, enum: ['vente', 'location'], required: true,
    },

    commission: {
      taux:        { type: Number, default: 10 },
      total:       { type: Number, default: 0 },
      ownerPayout: { type: Number, default: 0 },
      agencyNet:   { type: Number, default: 0 },
    },

    status: {
      type:    String,
      enum:    ['En cours', 'Paiement en attente', 'Réussie', 'Annulée', 'Litigée'],
      default: 'En cours',
      index:   true,
    },

    paymentStatus: {
      type:    String,
      enum:    ['non_initié', 'en_attente', 'confirmé', 'échoué', 'remboursé'],
      default: 'non_initié',
    },
    paymentMethod: {
      type: String,
      enum: ['cinetpay_mobile', 'cinetpay_carte', 'yabetoo_momo', 'virement', 'especes', 'cheque', null],
      default: null,
    },

    linkedInvoice: { type: ObjectId, ref: 'Document' },
    finalization: {
      operationKey: { type: String, maxlength: 200 },
      payloadHash: String,
      status: { type: String, enum: ['processing', 'completed', 'failed'] },
      startedAt: Date,
      completedAt: Date,
      attemptCount: { type: Number, default: 0 },
      invoice: { type: ObjectId, ref: 'Document' },
      previousPropertyState: { availability: String, isPublished: Boolean },
      lastError: String,
    },
    paiements:     [{ type: ObjectId, ref: 'PaiementTransaction' }],

    transactionDate: { type: Date, default: Date.now },
    notes:           { type: String, maxlength: 1000 },

    annulePar:    { type: ObjectId, ref: 'User' },
    annuleAt:     { type: Date },
    annuleRaison: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

transactionSchema.index({ client: 1, status: 1 });
transactionSchema.index({ property: 1 });
// Une annonce ne peut porter qu'un seul dossier susceptible d'aboutir. Cet
// index est le verrou de concurrence final : deux contrôleurs ou deux
// instances serveur ne peuvent pas ouvrir/finaliser deux ventes ou locations
// incompatibles après avoir toutes deux lu un état encore disponible.
transactionSchema.index(
  { property: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['En cours', 'Paiement en attente', 'Réussie', 'Litigée'] },
    },
    name: 'one_active_real_estate_transaction_per_property',
  },
);
transactionSchema.index({ 'finalization.operationKey': 1 }, { unique: true, partialFilterExpression: { 'finalization.operationKey': { $type: 'string' } } });

module.exports = mongoose.model('Transaction', transactionSchema);
