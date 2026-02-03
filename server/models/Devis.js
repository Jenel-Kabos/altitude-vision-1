const mongoose = require('mongoose');

const devisSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  amount: Number,
  status: String,
  date: Date,
}, {
  timestamps: true
});

module.exports = mongoose.model('Devis', devisSchema);