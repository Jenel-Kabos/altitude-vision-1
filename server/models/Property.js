const mongoose = require('mongoose');

const propertySchema = mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['Vente', 'Location'], required: true },
  price: { type: Number, required: true },
  address: { type: String, required: true },
  city: { type: String, default: 'Brazzaville' },
  district: { type: String, required: true }, // Quartier
  images: [{ type: String, required: true }],
  documents: [{ type: String }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublished: { type: Boolean, default: false },
}, { timestamps: true });

const Property = mongoose.model('Property', propertySchema);
module.exports = Property;