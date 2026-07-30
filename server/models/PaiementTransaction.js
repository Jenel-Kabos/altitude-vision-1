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
      enum: ['cinetpay_mobile', 'cinetpay_carte', 'yabetoo_momo', 'virement', 'especes', 'cheque'],
      required: true,
    },
    provider: { type: String, maxlength: 80 },

    // Statut : les valeurs historiques (en_attente/confirmé/échoué/remboursé) restent
    // utilisées par virement/espèces/chèque ; YabetooPay utilise les nouvelles valeurs
    // (En attente/Payé/Échoué/Annulé) — les deux jeux coexistent pour compatibilité.
    statut: {
      type:    String,
      enum:    ['en_attente', 'confirmé', 'échoué', 'remboursé', 'En attente', 'Payé', 'Échoué', 'Annulé'],
      default: 'en_attente',
    },

    // Legacy CinetPay — conservés pour compatibilité des données existantes
    cinetpayTransactionId: { type: String, sparse: true, index: true },
    paymentUrl:            { type: String },
    cinetpayRaw:           { type: Schema.Types.Mixed },

    // YabetooPay
    yabetooIntentId: { type: String, sparse: true, index: true },
    operateur:       { type: String, enum: ['AIRTEL', 'MTN'] },
    telephone:       { type: String },

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

paiementTransactionSchema.index(
  { transaction: 1, methode: 1 },
  {
    unique: true,
    partialFilterExpression: { statut: { $in: ['En attente', 'Payé'] } },
    name: 'one_open_yabetoo_payment_per_transaction',
  },
);

module.exports = mongoose.model('PaiementTransaction', paiementTransactionSchema);
