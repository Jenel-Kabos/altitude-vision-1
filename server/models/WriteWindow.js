const mongoose = require('mongoose');

// TTL index : MongoDB supprime automatiquement les documents après 10 minutes
const writeWindowSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  resourceId: { type: String, required: true, index: true },
  createdAt:  { type: Date, default: Date.now, expires: 600 }, // 600s = 10 min
});

writeWindowSchema.index({ userId: 1, resourceId: 1 }, { unique: true });

module.exports = mongoose.model('WriteWindow', writeWindowSchema);
