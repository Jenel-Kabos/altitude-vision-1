const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true },
});

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['Devis', 'Facture', 'Contrat', 'Etat des Lieux'],
    },
    status: {
      type: String,
      required: true,
      enum: ['Brouillon', 'Envoyé', 'Accepté', 'Refusé', 'Payé', 'En retard'],
      default: 'Brouillon',
    },
    client: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User', // Collaborateur or Admin
      required: true,
    },
    relatedProperty: { // Link to a property for a rental contract, etc.
      type: mongoose.Schema.ObjectId,
      ref: 'Property',
    },
    // Used for Devis and Facture
    items: [itemSchema],
    subTotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    
    // Used for Contrat and Etat des Lieux
    content: {
      type: String,
    },

    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date }, // Relevant for invoices
    notes: String,
  },
  {
    timestamps: true,
  }
);

// This plugin will add a 'docNumber' field that auto-increments
documentSchema.plugin(AutoIncrement, { inc_field: 'docNumber' });

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;