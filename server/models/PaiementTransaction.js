const mongoose = require('mongoose');
const { Schema } = mongoose;
const ObjectId  = Schema.Types.ObjectId;

const paiementTransactionSchema = new Schema(
  {
    transaction: { type: ObjectId, ref: 'Transaction', required: true, index: true },
    initiéPar:   { type: ObjectId, ref: 'User',        required: true },

    montant: { type: Number, required: true, min: 0 },
    methode: {
      type: String,
      enum: ['cinetpay_mobile', 'cinetpay_carte', 'virement', 'especes', 'cheque'],
      required: true,
    },
    provider: { type: String, maxlength: 80 },

    statut: {
      type:    String,
      enum:    ['en_attente', 'confirmé', 'échoué', 'remboursé'],
      default: 'en_attente',
    },

    cinetpayTransactionId: { type: String, sparse: true, index: true },
    paymentUrl:            { type: String },
    cinetpayRaw:           { type: Schema.Types.Mixed },

    referenceBancaire: { type: String, maxlength: 200 },
    preuvePaiement: {
      url:      { type: String },
      publicId: { type: String },
    },

    confirméPar: { type: ObjectId, ref: 'User' },
    confirméAt:  { type: Date },
    notes:       { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaiementTransaction', paiementTransactionSchema);
