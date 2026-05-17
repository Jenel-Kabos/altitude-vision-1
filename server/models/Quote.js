const mongoose = require('mongoose');

const quoteSchema = mongoose.Schema({
  clientName: { type: String, required: true },
  clientEmail: { type: String, required: true },
  eventType: { type: String, required: true }, // Mariage, Conférence, etc.
  services: [{
    name: String,
    price: Number,
    options: [String],
  }],
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['En attente', 'Accepté', 'Refusé'], default: 'En attente' },
}, { timestamps: true });

const Quote = mongoose.model('Quote', quoteSchema);
module.exports = Quote;