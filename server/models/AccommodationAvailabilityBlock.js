const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  accommodation: { type: mongoose.Schema.Types.ObjectId, ref: 'Accommodation', required: true, index: true },
  startDate: { type: Date, required: true }, endDate: { type: Date, required: true },
  type: { type: String, enum: ['maintenance', 'owner_block', 'administrative', 'other'], required: true },
  reason: { type: String, trim: true, maxlength: 1000, default: '' }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ accommodation: 1, startDate: 1, endDate: 1 });
module.exports = mongoose.model('AccommodationAvailabilityBlock', schema);
