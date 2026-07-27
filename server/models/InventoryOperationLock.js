const mongoose = require('mongoose');

const inventoryOperationLockSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, maxlength: 300 },
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  roomCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomCategory', default: null },
  dateFrom: { type: Date, required: true },
  dateTo: { type: Date, required: true },
  operation: { type: String, enum: ['inventory_rebuild'], required: true },
  ownerToken: { type: String, required: true, select: false },
  acquiredAt: { type: Date, required: true },
  heartbeatAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  acquiredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

inventoryOperationLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('InventoryOperationLock', inventoryOperationLockSchema);
