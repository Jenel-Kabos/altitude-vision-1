const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.ObjectId,
      ref: 'Property',
      required: true,
    },
    client: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    agent: { // The collaborator who closed the deal
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    finalAmount: {
      type: Number,
      required: [true, 'A transaction must have a final amount'],
    },
    transactionType: {
      type: String,
      required: true,
      enum: ['vente', 'location'],
    },
    status: {
      type: String,
      required: true,
      enum: ['En cours', 'Réussie', 'Annulée'],
      default: 'En cours',
    },
    commission: {
        total: Number, // Total commission for the agency
        ownerPayout: Number, // The 30% to be paid to the owner
    },
    linkedInvoice: { // A reference to the generated invoice
        type: mongoose.Schema.ObjectId,
        ref: 'Document',
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;