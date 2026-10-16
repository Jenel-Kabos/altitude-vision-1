// F-U1.C — Compteur atomique de plafonds et de soldes réservés.
//
// Primitive unique de contrôle concurrent : un document par clé (plafond par
// intervention, plafond mensuel d'un bien, solde remboursable d'un paiement).
// Les réservations utilisent un $inc conditionnel ($expr) dans une transaction
// MongoDB : deux validations simultanées ne peuvent pas dépasser le plafond.
// Le plafond n'est pas stocké ici : il provient du snapshot contractuel de
// l'opération, passé dans la condition de mise à jour.

const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  key: { type: String, required: true, maxlength: 300 },
  scopeType: { type: String, enum: ['EXPENSE_INTERVENTION', 'EXPENSE_MONTH', 'REFUND_PAYMENT', 'BILLING_LOCK'], required: true },
  reservedMinor: { type: Number, default: 0, min: 0 },
  // Incrémenté à chaque écriture : sert de verrou optimiste transactionnel.
  revision: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

schema.path('reservedMinor').validate(Number.isSafeInteger, 'reservedMinor doit être un entier sûr.');
schema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model('FinancialLimitCounter', schema);
