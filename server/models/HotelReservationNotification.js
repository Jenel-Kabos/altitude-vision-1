const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'HotelReservation', required: true },
  eventKey: { type: String, required: true },
  channel: { type: String, enum: ['internal', 'email'], required: true },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  recipient: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  sentAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
}, { timestamps: true });
schema.index({ reservation: 1, eventKey: 1, channel: 1 }, { unique: true });
module.exports = mongoose.model('HotelReservationNotification', schema);
