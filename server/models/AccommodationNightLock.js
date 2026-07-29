const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  accommodation: { type: mongoose.Schema.Types.ObjectId, ref: 'Accommodation', required: true },
  date: { type: Date, required: true },
  sourceType: { type: String, enum: ['reservation', 'block'], required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  operationToken: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { timestamps: true });
schema.index({ accommodation: 1, date: 1 }, { unique: true });
schema.index({ sourceType: 1, sourceId: 1 });
schema.index({ operationToken: 1 });
module.exports = mongoose.model('AccommodationNightLock', schema);
